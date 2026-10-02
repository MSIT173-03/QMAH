import { Component, ElementRef, HostListener, ViewChild, computed, inject, isDevMode, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MeApiService } from '../core/services/me-api';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { GameFocusMode } from '../core/services/game-focus-mode';

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
  protected readonly focusMode = inject(GameFocusMode);
  protected readonly canShowRooms = isDevMode();
  @ViewChild('tools') private tools?: ElementRef<HTMLDetailsElement>;
  protected readonly meApi = inject(MeApiService);
  protected readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);
  private readonly railStorageKey = 'qmah.game.navigation.collapsed';
  protected readonly railCollapsed = signal(this.readRailCollapsed());

  protected readonly links = [
    { label: '多人鑑定', description: '房間大廳', icon: 'users-round', path: '/game', activePrefixes: ['/game/demo', '/game/rooms', '/game/room'] },
    { label: '單人小遊戲', description: '單人挑戰', icon: 'gamepad-2', path: '/game/training', activePrefixes: ['/game/training', '/game/minigames'] },
    { label: '玩法試玩', description: '先玩再挑戰', icon: 'book-open', path: '/game/how-to', activePrefixes: ['/game/how-to'] },
    { label: '鑑賞回答', description: '讀回答、投一票', icon: 'book-open', path: '/game/appreciation', activePrefixes: ['/game/appreciation'] }
  ] as const;

  protected isActive(link: (typeof this.links)[number]): boolean {
    const currentPath = this.currentPath();
    return currentPath === link.path || link.activePrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
  }

  protected isTestActive(): boolean {
    const currentPath = this.currentPath();
    return currentPath === '/game/test' || currentPath.startsWith('/game/test/');
  }

  protected isDemoActive(): boolean { return this.currentPath() === '/game/demo'; }
  protected lobbyQuery(): Record<string, string> {
    const params = this.router.parseUrl(this.router.url).queryParams;
    return Object.fromEntries(['status', 'sort', 'page'].filter(key => params[key]).map(key => [key, params[key]]));
  }
  protected closeTools(): void { if (this.tools) this.tools.nativeElement.open = false; }
  @HostListener('keydown.escape') protected dismissTools(): void {
    if (this.tools?.nativeElement.open) {
      this.closeTools();
      this.tools.nativeElement.querySelector('summary')?.focus();
    }
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
