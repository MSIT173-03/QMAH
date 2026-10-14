import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiPage } from './social-api';

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  pointBalance: number;
  roles: string[];
  createdAt: string;
  bio: string | null;
  visibility: string;
  avatarPath: string | null;
}

export interface UserNotification {
  id: string;
  title: string;
  content: string;
  targetUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage extends ApiPage<UserNotification> {
  unreadCount: number;
  readCount: number;
  totalNotificationCount: number;
}

// 對應 QMAH.Api 的 MeController（User 領域，不是 Social 的一部分）。
// 個人資料、通知都是「會員自己的」資源，統一走 /api/v1/me/*，不要在 Social 這邊另開一份。
@Injectable({ providedIn: 'root' })
export class MeApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/me`;

  // 全站共用的「目前登入會員」狀態；null 表示未登入（或還沒查過）。
  // 登入／登出後由呼叫端 refresh()／clear()，導覽列等元件直接讀這個 signal 就會同步更新。
  readonly me = signal<Me | null>(null);

  private sessionRequest?: Subscription;

  refresh(): void {
    this.sessionRequest?.unsubscribe();
    this.sessionRequest = this.http.get<Me | null>(`${this.base}/session`).subscribe({
      next: (me) => this.me.set(me),
      error: (error: HttpErrorResponse) => {
        // 暫時斷線或伺服器忙碌不代表登出，保留已確認的會員與切換入口。
        if (error.status === 401 || error.status === 403) this.me.set(null);
      }
    });
  }

  clear(): void {
    this.sessionRequest?.unsubscribe();
    this.me.set(null);
  }

  getMe(): Observable<Me> {
    return this.http.get<Me>(this.base);
  }

  getNotifications(params: { page?: number; pageSize?: number; isRead?: boolean } = {}): Observable<NotificationPage> {
    let httpParams: Record<string, string> = {};
    if (params.page) httpParams['page'] = String(params.page);
    if (params.pageSize) httpParams['pageSize'] = String(params.pageSize);
    if (params.isRead !== undefined) httpParams['isRead'] = String(params.isRead);
    return this.http.get<NotificationPage>(`${this.base}/notifications`, { params: httpParams });
  }

  markNotificationRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/${id}/read`, {});
  }

  markNotificationUnread(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/${id}/unread`, {});
  }

  markAllNotificationsRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/read-all`, {});
  }
}
