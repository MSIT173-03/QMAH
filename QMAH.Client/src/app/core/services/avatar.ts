import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';

// 社群各處的作者頭像：元件只報上 userId，這裡把同一個畫面上的請求合併成一次批次 API，
// 並快取結果；沒有頭像或對方未公開時存 null，元件顯示預設人像圖示。
@Injectable({ providedIn: 'root' })
export class AvatarService {
  private http = inject(HttpClient);
  private url = `${environment.apiBaseUrl}/social/members/avatars`;

  private readonly cache = signal<Record<string, string | null>>({});
  private readonly requested = new Set<string>();
  private queue = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  // 在 computed／template 裡呼叫：讀 signal 所以快取更新時會自動重繪。
  get(userId: string | null | undefined): string | null {
    if (!userId) return null;
    const value = this.cache()[userId];
    if (value === undefined) this.request(userId);
    return value ?? null;
  }

  private request(userId: string): void {
    if (this.requested.has(userId)) return;
    this.requested.add(userId);
    this.queue.add(userId);
    this.timer ??= setTimeout(() => this.flush(), 20);
  }

  private flush(): void {
    const ids = [...this.queue];
    this.queue = new Set();
    this.timer = null;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      let params = new HttpParams();
      for (const id of chunk) params = params.append('ids', id);
      this.http.get<Record<string, string | null>>(this.url, { params }).subscribe({
        next: (result) => this.cache.update((current) => ({ ...current, ...result })),
        error: () => this.cache.update((current) => ({
          ...current,
          ...Object.fromEntries(chunk.map((id) => [id, null]))
        }))
      });
    }
  }
}
