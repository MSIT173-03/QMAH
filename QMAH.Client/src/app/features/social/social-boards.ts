import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

import { SocialApiService } from '../../core/services/social-api';

const CACHE_KEY = 'qmah-social-boards';
/** 第一次進站、還沒拿到 API 結果之前先用的標準看板，避免導覽一瞬間只剩一個分類 */
const FALLBACK_BOARDS = ['CATALOG', 'DISCOVERY', 'GENERAL', 'GUIDE', 'QUESTION', 'REVIEW'];

/**
 * 社群看板清單的單一來源：貼文牆、公告、活動三頁的導覽共用同一份，
 * 換頁時導覽立刻有完整清單（記憶體＋sessionStorage），背景再更新一次，不會閃爍或只剩一個分類。
 */
@Injectable({ providedIn: 'root' })
export class SocialBoardsStore {
  private readonly api = inject(SocialApiService);
  readonly boards = signal<string[]>(this.readCache());
  private loading$: Observable<string[]> | null = null;
  private loaded = false;

  /** 取得（並更新）看板清單；同時多處呼叫只會發出一次請求。 */
  load(): Observable<string[]> {
    if (this.loaded) return of(this.boards());
    this.loading$ ??= this.api.getBoards().pipe(
      tap((codes) => {
        this.loaded = true;
        this.boards.set(codes);
        this.writeCache(codes);
      }),
      finalize(() => (this.loading$ = null)),
      shareReplay(1),
    );
    return this.loading$;
  }

  private readCache(): string[] {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((x) => typeof x === 'string')) return parsed as string[];
    } catch {
      // 讀不到快取就用預設清單
    }
    return FALLBACK_BOARDS;
  }

  private writeCache(codes: string[]): void {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(codes));
    } catch {
      // 不能存就只在這次分頁內有效
    }
  }
}
