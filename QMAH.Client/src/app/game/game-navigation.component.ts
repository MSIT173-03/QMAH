import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MeApiService } from '../core/services/me-api';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';

// ui-integration: Game Area 內只保留一條模式與流程子導覽；跨 Area 導航仍由 Global App Shell 負責。
@Component({
  selector: 'app-game-navigation',
  imports: [RouterLink, QmahIconComponent],
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
  host: {
    '[class.is-collapsed]': 'railCollapsed()'
  }
})
export class GameNavigationComponent {
  private readonly router = inject(Router);
  protected readonly meApi = inject(MeApiService);
  protected readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);
  protected readonly railCollapsed = signal(this.readRailCollapsed());
  private readonly railStorageKey = 'qmah.game.navigation.collapsed';

  protected readonly links = [
    { label: '多人鑑定', description: '房間大廳', icon: 'users-round', path: '/game', activePrefixes: ['/game/demo', '/game/rooms', '/game/room'] },
    { label: '單人小遊戲', description: '單人挑戰', icon: 'gamepad-2', path: '/game/training', activePrefixes: ['/game/training', '/game/minigames'] },
    { label: '玩法說明', description: '完整流程', icon: 'book-open', path: '/game/how-to', activePrefixes: ['/game/how-to'] }
  ] as const;

  protected isActive(link: (typeof this.links)[number]): boolean {
    const currentPath = this.currentPath();
    return currentPath === link.path || link.activePrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
  }

  protected isTestActive(): boolean {
    const currentPath = this.currentPath();
    return currentPath === '/game/test' || currentPath.startsWith('/game/test/');
  }

  protected toggleRail(): void {
    const collapsed = !this.railCollapsed();
    this.railCollapsed.set(collapsed);
    try {
      localStorage.setItem(this.railStorageKey, String(collapsed));
    } catch {
      // ui-integration: 瀏覽器封鎖儲存時仍保留本次操作，不讓導覽收合失效。
    }
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].replace(/\/$/, '') || '/';
  }

  private readRailCollapsed(): boolean {
    try {
      return localStorage.getItem(this.railStorageKey) === 'true';
    } catch {
      return false;
    }
  }
}
