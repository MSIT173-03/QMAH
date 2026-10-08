import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { LucideUserRound } from '@lucide/angular';

import { AvatarService } from '../../../core/services/avatar';

// 作者名稱旁的小頭像；沒有 userId、沒有頭像或圖片載入失敗時，退回原本的人像圖示。
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [LucideUserRound],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @if (url && !failed()) {
      <img class="user-avatar__img" [src]="url" alt="" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <svg lucideUserRound class="user-avatar__fallback" aria-hidden="true" focusable="false"></svg>
    }
  `,
  styles: [`
    :host {
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      width: var(--user-avatar-size, 1.5rem);
      height: var(--user-avatar-size, 1.5rem);
      overflow: hidden;
      border-radius: 50%;
      background: var(--qmah-surface-muted);
      color: var(--qmah-muted);
    }
    .user-avatar__img { width: 100%; height: 100%; object-fit: cover; }
    .user-avatar__fallback { width: 62%; height: 62%; }
  `]
})
export class UserAvatarComponent {
  private avatars = inject(AvatarService);

  @Input() userId: string | null | undefined;
  readonly failed = signal(false);

  get url(): string | null {
    return this.avatars.get(this.userId);
  }
}
