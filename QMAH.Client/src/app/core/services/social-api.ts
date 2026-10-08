import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// 分頁包裝，對應 QMAH.Api 的 ApiPage<T>（QMAH.Api/Controllers/V1/ApiPaging.cs）
export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SocialPostListItem {
  id: string;
  boardCode: string;
  userId: string;
  displayName: string | null;
  artifactId: string | null;
  eventId: string | null;
  postType: 'POST' | 'ANNOUNCEMENT' | 'EVENT';
  publisherType: 'COMMUNITY' | 'OFFICIAL';
  title: string;
  contentPreview: string;
  commentCount: number;
  mediaCount: number;
  coverImageUrl: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMemberProfile {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string | null;
  email: string | null;
  isPublic: boolean;
  postCount: number;
  eventCount: number;
}

export interface SocialComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  userId: string;
  displayName: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMedia {
  id: string;
  url: string;
  altText: string | null;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

/** 文物討論串的文物卡；玩家沒有該文物時 unlocked=false，其餘欄位為 null（畫面顯示問號）。 */
export interface SocialPostArtifact {
  artifactId: string;
  unlocked: boolean;
  hasUniversalKey: boolean;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  categoryName: string | null;
  eraName: string | null;
  eraText: string | null;
  creator: string | null;
  sizeText: string | null;
}

export interface SocialPostDetails {
  id: string;
  boardCode: string;
  userId: string;
  displayName: string | null;
  artifactId: string | null;
  eventId: string | null;
  postType: 'POST' | 'ANNOUNCEMENT' | 'EVENT';
  publisherType: 'COMMUNITY' | 'OFFICIAL';
  title: string;
  content: string;
  comments: SocialComment[];
  media: SocialMedia[];
  /** 圖片排版：SECONDARY 文字為主、PRIMARY 圖片為主（舊資料沒有時視為 SECONDARY） */
  mediaLayout?: 'PRIMARY' | 'SECONDARY';
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventListItem {
  id: string;
  socialPostId: string | null;
  eventType: 'PLAYER' | 'OFFICIAL';
  organizerUserId: string | null;
  organizerDisplayName: string | null;
  title: string;
  content: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  startAt: string;
  endAt: string;
  registrationEndAt: string | null;
  capacity: number | null;
  registrationCount: number;
  coverImageUrl: string | null;
}

export interface SocialEventDetails extends EventListItem {
  isRegistered: boolean;
  media: SocialMedia[];
  reviewStatus: string | null;
  publishStatus: string | null;
}

export interface EventRegistrant {
  userId: string;
  displayName: string | null;
  status: 'REGISTERED' | 'ATTENDED' | 'CANCELLED';
  registeredAt: string;
}

export interface EventRegistrations {
  active: EventRegistrant[];
  cancelled: EventRegistrant[];
}

export interface Announcement {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string;
  publishAt: string | null;
  endAt: string | null;
  userId: string;
  displayName: string | null;
  postType: string;
  publisherType: string;
  eventId: string | null;
  createdAt: string;
}

export interface CreateSocialPostRequest {
  // 前台只能發一般貼文；站方公告改由 QMAH.Web 後台「貼文處理」發布（可附圖片）。
  postType?: 'POST';
  boardCode: string;
  title: string;
  content: string;
  artifactId?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mediaIds?: string[];
  /** 圖片排版：SECONDARY 文字為主（預設）、PRIMARY 圖片為主 */
  mediaLayout?: 'PRIMARY' | 'SECONDARY';
}

export interface CreateSocialCommentRequest {
  content: string;
  parentCommentId?: string | null;
}

export interface EnsureArtifactDiscussionRequest {
  initialComment: string;
}

export interface EnsureArtifactDiscussionResult {
  postId: string;
  created: boolean;
  commentId: string;
}

export interface UpdateSocialPostRequest {
  title: string;
  content: string;
  mediaLayout?: 'PRIMARY' | 'SECONDARY';
  /** 最後要保留的圖片（順序即顯示順序）；不傳代表圖片不變，沒列出的既有圖片會被移除 */
  mediaIds?: string[];
}

export interface UpdateSocialCommentRequest {
  content: string;
}

export interface CreateSocialEventRequest {
  eventType: 'PLAYER' | 'OFFICIAL';
  title: string;
  content: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startAt: string;
  endAt: string;
  registrationEndAt?: string | null;
  capacity?: number | null;
  postContentMode?: 'TEMPLATE' | 'CUSTOM';
  postTitle?: string | null;
  postContent?: string | null;
  mediaIds?: string[];
}

export interface CreateContentReportRequest {
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  reason: string;
  detail?: string | null;
}

// 對應 QMAH.Api 的 Social 使用者端點（SocialController／SocialMediaController／SocialNotificationsController）。
// 後台管理功能（貼文/留言/檢舉/活動/關鍵字）已搬到 QMAH.Web 的 Razor 後台，這裡只保留一般使用者會呼叫的 API。
// 登入 Cookie 與 XSRF-TOKEN-API 由 app.config.ts 的 apiCredentialsInterceptor／withXsrfConfiguration 統一處理，
// 這裡不重複處理身分驗證。
@Injectable({ providedIn: 'root' })
export class SocialApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/social`;

  // ---- 貼文 ----

  getPosts(params: {
    q?: string;
    boardCode?: string;
    postType?: string;
    artifactId?: string;
    userId?: string;
    /** 發布時間範圍：起（含）、迄（不含），ISO 時間 */
    createdAfter?: string;
    createdBefore?: string;
    /** newest（預設，新到舊）或 oldest（舊到新） */
    sort?: 'newest' | 'oldest';
    page?: number;
    pageSize?: number;
  } = {}): Observable<ApiPage<SocialPostListItem>> {
    return this.http.get<ApiPage<SocialPostListItem>>(`${this.base}/posts`, {
      params: this.toHttpParams(params)
    });
  }

  getMember(userId: string): Observable<SocialMemberProfile> {
    return this.http.get<SocialMemberProfile>(`${this.base}/members/${userId}`);
  }

  getPost(id: string): Observable<SocialPostDetails> {
    return this.http.get<SocialPostDetails>(`${this.base}/posts/${id}`);
  }

  getPostArtifact(id: string): Observable<SocialPostArtifact> {
    return this.http.get<SocialPostArtifact>(`${this.base}/posts/${id}/artifact`);
  }

  createPost(request: CreateSocialPostRequest): Observable<SocialPostDetails> {
    return this.http.post<SocialPostDetails>(`${this.base}/posts`, request);
  }

  // 圖鑑的確認視窗會把「建立貼文＋第一則留言」送成一次 API，避免只建立空貼文後留言失敗。
  ensureArtifactDiscussion(
    artifactId: string,
    request: EnsureArtifactDiscussionRequest
  ): Observable<EnsureArtifactDiscussionResult> {
    return this.http.post<EnsureArtifactDiscussionResult>(
      `${this.base}/artifacts/${artifactId}/discussion`,
      request
    );
  }

  // 只有作者本人能改自己的貼文；活動的社群入口貼文不開放直接編輯／刪除。
  updatePost(id: string, request: UpdateSocialPostRequest): Observable<{ message: string; id: string; title: string; content: string; updatedAt: string }> {
    return this.http.put<{ message: string; id: string; title: string; content: string; updatedAt: string }>(
      `${this.base}/posts/${id}`,
      request
    );
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/posts/${id}`);
  }

  createComment(postId: string, request: CreateSocialCommentRequest): Observable<SocialComment> {
    return this.http.post<SocialComment>(`${this.base}/posts/${postId}/comments`, request);
  }

  updateComment(id: string, request: UpdateSocialCommentRequest): Observable<{ message: string; id: string; content: string; updatedAt: string }> {
    return this.http.put<{ message: string; id: string; content: string; updatedAt: string }>(
      `${this.base}/comments/${id}`,
      request
    );
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${id}`);
  }

  // ---- 活動 ----

  getEvents(params: {
    q?: string;
    startAfter?: string;
    startBefore?: string;
    organizerUserId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Observable<ApiPage<EventListItem>> {
    return this.http.get<ApiPage<EventListItem>>(`${this.base}/events`, {
      params: this.toHttpParams(params)
    });
  }

  // GET /api/v1/social/boards：標準看板清單 + 資料庫既有看板代碼合併
  getBoards(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/boards`);
  }

  // 只有活動發起人與 Admin 可呼叫，其他人會得到 403。
  getEventRegistrations(id: string): Observable<EventRegistrations> {
    return this.http.get<EventRegistrations>(`${this.base}/events/${id}/registrations`);
  }

  getEvent(id: string): Observable<SocialEventDetails> {
    return this.http.get<SocialEventDetails>(`${this.base}/events/${id}`);
  }

  createEvent(request: CreateSocialEventRequest): Observable<SocialEventDetails> {
    return this.http.post<SocialEventDetails>(`${this.base}/events`, request);
  }

  registerEvent(id: string): Observable<SocialEventDetails> {
    return this.http.post<SocialEventDetails>(`${this.base}/events/${id}/registration`, {});
  }

  cancelEventRegistration(id: string): Observable<SocialEventDetails> {
    return this.http.delete<SocialEventDetails>(`${this.base}/events/${id}/registration`);
  }

  // ---- 公告 ----

  getAnnouncements(params: { page?: number; pageSize?: number } = {}): Observable<ApiPage<Announcement>> {
    return this.http.get<ApiPage<Announcement>>(`${this.base}/announcements`, {
      params: this.toHttpParams(params)
    });
  }

  // ---- 檢舉（一般使用者送出） ----

  createReport(request: CreateContentReportRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/reports`, request);
  }

  // ---- 圖片 ----

  uploadMedia(file: File, altText?: string): Observable<SocialMedia> {
    const formData = new FormData();
    formData.append('file', file);
    if (altText) formData.append('altText', altText);
    return this.http.post<SocialMedia>(`${this.base}/media`, formData);
  }

  deleteMedia(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/media/${id}`);
  }

  private toHttpParams(params: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
