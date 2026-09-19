import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { finalize, shareReplay, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  ApiPage,
  CompleteMiniGameRequest,
  CreateGameRoomRequest,
  GameAnswer,
  GameAnswerType,
  GameRoomDetails,
  GameRoomHistory,
  GameRoomListItem,
  GameRoomQuery,
  GameRoomSort,
  GameRoundDetails,
  GameValidationError,
  JoinGameRoomRequest,
  MainGameReward,
  MiniGameComplete,
  MiniGameMode,
  MiniGameStart,
  StartMiniGameRequest,
  SubmitAnswerRequest,
  SubmitVoteRequest
} from './game.models';

const ANSWER_TYPES: readonly GameAnswerType[] = [
  'CREATIVE_TALE',
  'PLAUSIBLE_FICTION',
  'FACTUAL_REASONING'
];

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/game`;

  // 只保存目前頁面需要的快照；真正的遊戲狀態仍以 API 回應為準。
  private readonly roomState = signal<GameRoomDetails | null>(null);
  private readonly roundState = signal<GameRoundDetails | null>(null);
  private readonly historyState = signal<GameRoomHistory | null>(null);

  readonly currentRoom = this.roomState.asReadonly();
  readonly currentRound = this.roundState.asReadonly();
  readonly currentHistory = this.historyState.asReadonly();

  // API 的 POST、PUT、DELETE 都需要 request token；同一個 service 只共用一次進行中的 token 請求。
  private antiforgeryReady = false;
  private antiforgeryRequest$: Observable<void> | undefined;

  /** 取得公開房間；不帶狀態時沿用 API 預設的等待中房間。 */
  getRooms(query: GameRoomQuery = {}): Observable<ApiPage<GameRoomListItem>> {
    let params = new HttpParams()
      .set('page', String(this.boundedInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER)))
      .set('pageSize', String(this.boundedInteger(query.pageSize, 20, 1, 100)));
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);
    return this.http.get<ApiPage<GameRoomListItem>>(`${this.apiUrl}/rooms`, { params });
  }

  /** 讀取房間詳細資料並更新目前房間快照。 */
  getRoom(roomId: string): Observable<GameRoomDetails> {
    return this.http
      .get<GameRoomDetails>(`${this.apiUrl}/rooms/${encodeURIComponent(roomId)}`)
      .pipe(tap((room) => this.roomState.set(room)));
  }

  /** 讀取房間歷史與排行榜並更新目前歷史快照。 */
  getRoomHistory(roomId: string): Observable<GameRoomHistory> {
    return this.http
      .get<GameRoomHistory>(`${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/history`)
      .pipe(tap((history) => this.historyState.set(history)));
  }

  /** 建立房間畫面可直接使用的 API 預設值，避免各元件各自維護一份規則。 */
  roomDefaults(): CreateGameRoomRequest {
    return {
      visibility: 'PUBLIC',
      password: null,
      displayName: '玩家',
      maxPlayers: 6,
      totalRounds: 3,
      answerSeconds: 120,
      votingSeconds: 60,
      categoryFilterCode: null,
      eraBucketFilterCode: null
    };
  }

  /** 建立房間；資料整理與前端可立即提示的欄位檢查集中在 service。 */
  createRoom(request: CreateGameRoomRequest): Observable<GameRoomDetails> {
    const normalized = this.normalizeCreateRoomRequest(request);
    const errors = this.validateCreateRoomRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() => this.http.post<GameRoomDetails>(`${this.apiUrl}/rooms`, normalized)).pipe(
      tap((room) => this.roomState.set(room))
    );
  }

  /** 加入房間；是否仍在等待、是否額滿及私人密碼由 API 最終判定。 */
  joinRoom(roomId: string, request: JoinGameRoomRequest): Observable<GameRoomDetails> {
    const normalized = this.normalizeJoinRoomRequest(request);
    const errors = this.validateJoinGameRoomRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() =>
      this.http.post<GameRoomDetails>(
        `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/join`,
        normalized
      )
    ).pipe(tap((room) => this.roomState.set(room)));
  }

  setReady(roomId: string, isReady: boolean): Observable<GameRoomDetails> {
    return this.mutate(() => this.http.post<GameRoomDetails>(
      `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/ready`,
      { isReady }
    )).pipe(tap((room) => this.roomState.set(room)));
  }

  startRoom(roomId: string): Observable<GameRoomDetails> {
    return this.mutate(() => this.http.post<GameRoomDetails>(
      `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/start`,
      null
    )).pipe(tap((room) => this.roomState.set(room)));
  }

  leaveRoom(roomId: string): Observable<void> {
    return this.mutate(() => this.http.post<void>(
      `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/leave`,
      null
    )).pipe(tap(() => {
      if (this.roomState()?.id === roomId) this.roomState.set(null);
      this.roundState.set(null);
      this.historyState.set(null);
    }));
  }

  heartbeat(roomId: string): Observable<void> {
    return this.mutate(() => this.http.post<void>(
      `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/heartbeat`,
      null
    ));
  }

  /** 讀取回合詳細資料並更新目前回合快照。 */
  getRound(roundId: string): Observable<GameRoundDetails> {
    return this.http
      .get<GameRoundDetails>(`${this.apiUrl}/rounds/${encodeURIComponent(roundId)}`)
      .pipe(tap((round) => this.roundState.set(round)));
  }

  /** 送出回答並更新目前回合快照；截止時間與重複提交仍由 API 驗證。 */
  submitAnswer(roundId: string, request: SubmitAnswerRequest): Observable<GameAnswer> {
    const normalized = this.normalizeSubmitAnswerRequest(request);
    const errors = this.validateSubmitAnswerRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() =>
      this.http.post<GameAnswer>(
        `${this.apiUrl}/rounds/${encodeURIComponent(roundId)}/answers`,
        normalized
      )
    ).pipe(
      tap((answer) =>
        this.roundState.update((round) =>
          round ? { ...round, answers: [...round.answers, answer] } : round
        )
      )
    );
  }

  /** 送出投票；不能投自己與回合階段等跨玩家規則由 API 最終判定。 */
  submitVote(roundId: string, request: SubmitVoteRequest): Observable<void> {
    const normalized = { ...request, answerId: request.answerId.trim() };
    const errors = this.validateSubmitVoteRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() =>
      this.http.post<void>(
        `${this.apiUrl}/rounds/${encodeURIComponent(roundId)}/votes`,
        normalized
      )
    );
  }

  /** 取得目前啟用的 Mini Game 模式與評分門檻。 */
  getMiniGameModes(): Observable<MiniGameMode[]> {
    return this.http.get<MiniGameMode[]>(`${this.apiUrl}/modes`);
  }

  /** 開始 Mini Game；素材、難度與 seed 必須採用 API 回傳值。 */
  startMiniGame(request: StartMiniGameRequest | string): Observable<MiniGameStart> {
    const normalized: StartMiniGameRequest = {
      modeCode: typeof request === 'string' ? request.trim() : request.modeCode.trim()
    };
    const errors = this.validateStartMiniGameRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() => this.http.post<MiniGameStart>(`${this.apiUrl}/attempts`, normalized));
  }

  /** 完成 Mini Game；等級與經濟獎勵由 API 依 Attempt 設定重新計算。 */
  completeMiniGame(
    attemptId: string,
    request: CompleteMiniGameRequest
  ): Observable<MiniGameComplete> {
    const normalized = {
      rawScore: Math.trunc(request.rawScore),
      rawResultJson: request.rawResultJson.trim()
    };
    const errors = this.validateCompleteMiniGameRequest(normalized);
    if (errors.length > 0) return this.invalid(errors);

    return this.mutate(() =>
      this.http.post<MiniGameComplete>(
        `${this.apiUrl}/attempts/${encodeURIComponent(attemptId)}/complete`,
        normalized
      )
    );
  }

  /** 領取會員在多人主遊戲中的一次性獎勵；重複呼叫由 API 保持冪等。 */
  rewardMainGame(roomId: string): Observable<MainGameReward> {
    return this.mutate(() =>
      this.http.post<MainGameReward>(
        `${this.apiUrl}/rooms/${encodeURIComponent(roomId)}/reward`,
        null
      )
    );
  }

  /** 判斷回答階段是否仍開放；倒數以 API 傳回的 UTC 截止時間計算。 */
  canAnswer(round: Pick<GameRoundDetails, 'status' | 'answerDeadlineAt'>, now = Date.now()): boolean {
    return round.status === 'ANSWERING' && this.remainingSeconds(round.answerDeadlineAt, now) > 0;
  }

  /** 判斷投票階段是否仍開放；倒數以 API 傳回的 UTC 截止時間計算。 */
  canVote(round: Pick<GameRoundDetails, 'status' | 'votingDeadlineAt'>, now = Date.now()): boolean {
    return round.status === 'VOTING' && this.remainingSeconds(round.votingDeadlineAt, now) > 0;
  }

  /** 將截止時間換算為不小於零的秒數；時間格式錯誤時回傳零。 */
  remainingSeconds(deadline: string | Date, now = Date.now()): number {
    const deadlineAt = typeof deadline === 'string' ? Date.parse(deadline) : deadline.getTime();
    return Number.isFinite(deadlineAt) ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : 0;
  }

  /** 等待中且尚有座位時才能顯示加入房間操作。 */
  canJoinRoom(room: Pick<GameRoomDetails, 'status' | 'players' | 'maxPlayers'>): boolean {
    return room.status === 'WAITING' && room.players.length < room.maxPlayers;
  }

  /** 將服務錯誤轉成一般玩家看得懂、也能採取行動的訊息。 */
  errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return error instanceof Error ? this.humanizeError(error.message) : '遊戲服務發生未知錯誤。';
    }
    const body = error.error as Record<string, unknown> | null;
    const detail = body?.['detail'];
    const title = body?.['title'];
    // ui-integration: 遊戲頁不直接暴露 API、HTTP 或內部欄位名稱；保留可理解的服務訊息，其餘轉成玩家可採取行動的提示。
    if (typeof detail === 'string' && detail) return this.humanizeError(detail);
    if (typeof title === 'string' && title) return this.humanizeError(title);
    return error.status === 0
      ? '目前無法連線到遊戲服務，請稍後再試。'
      : '遊戲服務目前無法完成這項操作，請稍後再試。';
  }

  /** 離開測試頁或遊戲房間時清除前端快照，避免下一頁看到舊資料。 */
  clearState(): void {
    this.roomState.set(null);
    this.roundState.set(null);
    this.historyState.set(null);
  }

  /** 建立房間前先在前端回報可立即修正的欄位錯誤，仍由 API 做最終驗證。 */
  validateCreateRoomRequest(request: CreateGameRoomRequest): string[] {
    const errors: string[] = [];
    if (!request.displayName) errors.push('顯示名稱不可空白。');
    if (request.displayName.length > 80) errors.push('顯示名稱不可超過 80 個字元。');
    if (request.visibility !== 'PUBLIC' && request.visibility !== 'PRIVATE') {
      errors.push('房間類型設定不正確。');
    }
    if (request.visibility === 'PRIVATE' && !request.password) errors.push('私人房間必須設定密碼。');
    if (request.visibility === 'PUBLIC' && request.password) errors.push('公開房間不可設定密碼。');
    if (request.password && request.password.length > 128) errors.push('房間密碼不可超過 128 個字元。');
    if (!Number.isInteger(request.maxPlayers) || request.maxPlayers < 3 || request.maxPlayers > 10) {
      errors.push('玩家人數必須介於 3 至 10 人。');
    }
    if (!Number.isInteger(request.totalRounds) || request.totalRounds < 1 || request.totalRounds > 5) {
      errors.push('回合數必須介於 1 至 5 回合。');
    }
    if (!Number.isInteger(request.answerSeconds) || request.answerSeconds < 30 || request.answerSeconds > 300) {
      errors.push('回答時間必須介於 30 至 300 秒。');
    }
    if (!Number.isInteger(request.votingSeconds) || request.votingSeconds < 20 || request.votingSeconds > 180) {
      errors.push('投票時間必須介於 20 至 180 秒。');
    }
    if (request.categoryFilterCode && request.categoryFilterCode.length > 32) {
      errors.push('分類篩選代碼不可超過 32 個字元。');
    }
    if (request.eraBucketFilterCode && request.eraBucketFilterCode.length > 32) {
      errors.push('年代篩選代碼不可超過 32 個字元。');
    }
    return errors;
  }

  /** 加入房間前檢查顯示名稱與密碼長度，房間狀態由 API 判定。 */
  validateJoinGameRoomRequest(request: JoinGameRoomRequest): string[] {
    const errors: string[] = [];
    if (!request.displayName) errors.push('顯示名稱不可空白。');
    if (request.displayName.length > 80) errors.push('顯示名稱不可超過 80 個字元。');
    if (request.password && request.password.length > 128) errors.push('房間密碼不可超過 128 個字元。');
    return errors;
  }

  private normalizeCreateRoomRequest(request: CreateGameRoomRequest): CreateGameRoomRequest {
    return {
      ...request,
      visibility: request.visibility.trim().toUpperCase() as CreateGameRoomRequest['visibility'],
      displayName: request.displayName.trim(),
      password: request.password ?? null,
      categoryFilterCode: request.categoryFilterCode?.trim().toUpperCase() || null,
      eraBucketFilterCode: request.eraBucketFilterCode?.trim().toUpperCase() || null
    };
  }

  private normalizeJoinRoomRequest(request: JoinGameRoomRequest): JoinGameRoomRequest {
    return {
      ...request,
      displayName: request.displayName.trim(),
      password: request.password ?? null
    };
  }

  private normalizeSubmitAnswerRequest(request: SubmitAnswerRequest): SubmitAnswerRequest {
    return {
      answerType: request.answerType.trim().toUpperCase() as GameAnswerType,
      text: request.text.trim()
    };
  }

  private validateSubmitAnswerRequest(request: SubmitAnswerRequest): string[] {
    const errors: string[] = [];
    if (!ANSWER_TYPES.includes(request.answerType)) errors.push('回答類型不符合遊戲規則。');
    if (!request.text) errors.push('回答內容不可空白。');
    if (request.text.length > 500) errors.push('回答內容不可超過 500 個字元。');
    return errors;
  }

  private validateSubmitVoteRequest(request: SubmitVoteRequest): string[] {
    const errors: string[] = [];
    if (!request.answerId) errors.push('請先選擇一個回答。');
    if (!Number.isInteger(request.count) || request.count < 1 || request.count > 3) {
      errors.push('票數必須介於 1 至 3 票。');
    }
    return errors;
  }

  private validateStartMiniGameRequest(request: StartMiniGameRequest): string[] {
    if (!request.modeCode) return ['請選擇一個遊戲模式。'];
    return request.modeCode.length > 40 ? ['小遊戲設定不正確。'] : [];
  }

  private validateCompleteMiniGameRequest(request: CompleteMiniGameRequest): string[] {
    const errors: string[] = [];
    if (!Number.isInteger(request.rawScore) || request.rawScore < 0 || request.rawScore > 100) {
      errors.push('成績必須介於 0 至 100 分。');
    }
    if (!request.rawResultJson) {
      errors.push('遊戲結果不可空白。');
    } else if (request.rawResultJson.length > 4000) {
      errors.push('遊戲結果太長，請重新開始。');
    } else {
      try {
        const parsed: unknown = JSON.parse(request.rawResultJson);
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
          errors.push('遊戲結果格式不正確，請重新開始。');
        }
      } catch {
        errors.push('遊戲結果格式不正確，請重新開始。');
      }
    }
    return errors;
  }

  private humanizeError(message: string): string {
    const value = message.trim();
    if (!value) return '遊戲服務目前無法完成這項操作，請稍後再試。';
    if (/\b(api|http|status code|status)\b/i.test(value)) return '遊戲服務目前無法完成這項操作，請稍後再試。';
    if (/找不到啟用中的 mini\s*game 模式/i.test(value)) return '目前沒有可用的單人玩法，請稍後再試。';
    if (/沒有可供 mini\s*game 使用的啟用文物/i.test(value)) return '目前沒有可用的館藏，請稍後再試。';
    if (/找不到目前會員的 mini\s*game attempt/i.test(value)) return '找不到這次練習，請重新開始。';
    if (/\b(mini\s*game|visibility|modecode|rawresultjson)\b/i.test(value)) return '遊戲資料設定不正確，請重新開始。';
    if (/\bjson\b/i.test(value)) return '遊戲結果格式不正確，請重新開始。';
    return value;
  }

  private invalid<T>(messages: readonly string[]): Observable<T> {
    return throwError(() => new GameValidationError(messages));
  }

  private mutate<T>(request: () => Observable<T>): Observable<T> {
    return this.ensureAntiforgeryToken().pipe(switchMap(() => request()));
  }

  private ensureAntiforgeryToken(): Observable<void> {
    if (this.antiforgeryReady) return of(void 0);
    if (!this.antiforgeryRequest$) {
      this.antiforgeryRequest$ = this.http
        .get<void>(`${environment.apiBaseUrl}/account/antiforgery-token`)
        .pipe(
          tap(() => (this.antiforgeryReady = true)),
          finalize(() => (this.antiforgeryRequest$ = undefined)),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this.antiforgeryRequest$;
  }

  private boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
    const integer = Number.isFinite(value) ? Math.trunc(value as number) : fallback;
    return Math.min(maximum, Math.max(minimum, integer));
  }
}
