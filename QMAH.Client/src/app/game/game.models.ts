// 對應 /api/v1/game 的資料契約；遊戲規則判斷集中在 GameService，元件只負責呈現結果。
export type GameRoomStatus = 'WAITING' | 'PLAYING' | 'COMPLETED' | 'CANCELLED';
export type GameRoomFilterStatus = Exclude<GameRoomStatus, 'CANCELLED'>;
export type GameRoomVisibility = 'PUBLIC' | 'PRIVATE';
export type GameRoundStatus = 'ANSWERING' | 'VOTING' | 'REVEALED';
export type GameAnswerType = 'CREATIVE_TALE' | 'PLAUSIBLE_FICTION' | 'FACTUAL_REASONING';

export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface GameRoomListItem {
  id: string;
  roomCode: string;
  status: GameRoomStatus;
  visibility: GameRoomVisibility;
  maxPlayers: number;
  totalRounds: number;
  playerCount: number;
  createdAt: string;
}

export interface GamePlayer {
  id: string;
  displayName: string;
  role: string;
  isReady: boolean;
  seatNo: number | null;
  connectionStatus: string;
}

export interface GameRoomDetails {
  id: string;
  roomCode: string;
  status: GameRoomStatus;
  visibility: GameRoomVisibility;
  maxPlayers: number;
  totalRounds: number;
  answerSeconds: number;
  votingSeconds: number;
  categoryFilterCode: string | null;
  eraBucketFilterCode: string | null;
  currentRoundNo: number;
  playerCount?: number;
  players: GamePlayer[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface GameAnswer {
  id: string;
  gamePlayerId: string;
  playerDisplayName: string;
  answerType: GameAnswerType;
  text: string;
  voteCount: number;
  rank: number;
  isWinner: boolean;
  submittedAt: string;
}

export interface GameRoundDetails {
  id: string;
  roomId: string;
  artifactId: string;
  artifactName: string;
  roundNumber: number;
  status: GameRoundStatus;
  isSettled: boolean;
  startedAt: string;
  answerDeadlineAt: string;
  votingDeadlineAt: string;
  settledAt: string | null;
  participantCount: number;
  totalVoteCount: number;
  winnerAnswerId: string | null;
  winnerPlayerDisplayName: string | null;
  answers: GameAnswer[];
}

export interface GameRoundSummary {
  id: string;
  roundNumber: number;
  artifactId: string;
  artifactName: string;
  status: GameRoundStatus;
  isSettled: boolean;
  startedAt: string;
  settledAt: string | null;
  answerCount: number;
  totalVoteCount: number;
  winnerAnswerId: string | null;
  winnerPlayerDisplayName: string | null;
  answers: GameAnswer[];
}

export interface GameLeaderboardItem {
  gamePlayerId: string;
  displayName: string;
  score: number;
  roundsAnswered: number;
  roundsWon: number;
  rank: number;
}

export interface GameRoomHistory {
  roomId: string;
  roomCode: string;
  status: GameRoomStatus;
  rounds: GameRoundSummary[];
  leaderboard: GameLeaderboardItem[];
}

export interface CreateGameRoomRequest {
  visibility: GameRoomVisibility;
  password?: string | null;
  displayName: string;
  maxPlayers: number;
  totalRounds: number;
  answerSeconds: number;
  votingSeconds: number;
  categoryFilterCode?: string | null;
  eraBucketFilterCode?: string | null;
}

export interface JoinGameRoomRequest {
  displayName: string;
  password?: string | null;
}

export interface SubmitAnswerRequest {
  answerType: GameAnswerType;
  text: string;
}

export interface SubmitVoteRequest {
  answerId: string;
  count: number;
}

export interface MiniGameMode {
  id: string;
  code: string;
  name: string;
  description: string;
  configJson: string | null;
  gradeBThreshold: number;
  gradeAThreshold: number;
  gradeSThreshold: number;
}

export interface MiniGameArtifact {
  artifactId: string;
  name: string;
  primaryImagePath: string;
  thumbnailPath: string | null;
}

export interface MiniGameStart {
  attemptId: string;
  modeCode: string;
  modeName: string;
  artifactId: string;
  artifactName: string;
  primaryImagePath: string;
  thumbnailPath: string | null;
  artifactPool: MiniGameArtifact[];
  difficulty: string;
  seed: string;
  configJson: string | null;
  startedAt: string;
}

export interface StartMiniGameRequest {
  modeCode: string;
}

export interface CompleteMiniGameRequest {
  rawScore: number;
  rawResultJson?: string | null;
}

export interface MiniGameComplete {
  attemptId: string;
  modeCode: string;
  rawScore: number;
  normalizedScore: number;
  grade: string;
  pointReward: number;
  keyProgressReward: number;
  convertedNormalKeys: number;
  remainingKeyProgress: number;
  economicRewardGranted: boolean;
  alreadyCompleted: boolean;
  completedAt: string;
}

export interface MainGameReward {
  pointReward: number;
  normalKeyReward: number;
  performanceScore: number;
  roundsWon: number;
  alreadyRewarded: boolean;
}

/** 前端在送出 HTTP 請求前發現的欄位錯誤；API 回應錯誤仍由 GameService.errorMessage 處理。 */
export class GameValidationError extends Error {
  constructor(readonly messages: readonly string[]) {
    super(messages.join(' '));
    this.name = 'GameValidationError';
  }
}

export interface GameRoomQuery {
  status?: GameRoomFilterStatus;
  page?: number;
  pageSize?: number;
}
