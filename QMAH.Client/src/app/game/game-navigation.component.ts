import { Component, DestroyRef, ElementRef, HostListener, computed, inject, isDevMode, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { MeApiService } from '../core/services/me-api';
import { QmahIconComponent } from '../shared/components/qmah-icon/qmah-icon';
import { GameFocusMode } from '../core/services/game-focus-mode';
import { GameFontsDirective } from './game-fonts.directive';
import { GameConsole } from './game-console.service';
import { GameAudio } from './game-audio.service';
import { GameAudioToggleComponent } from './game-audio-toggle.component';

// ui-integration: Game Area 內只保留一條模式與流程子導覽；跨 Area 導航仍由 Global App Shell 負責。
@Component({
  selector: 'app-game-navigation',
  hostDirectives: [GameFontsDirective],
  imports: [RouterLink, QmahIconComponent, GameAudioToggleComponent],
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
})
export class GameNavigationComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  protected readonly focusMode = inject(GameFocusMode);
  protected readonly canShowRooms = isDevMode();
  private readonly console = inject(GameConsole);
  private readonly audio = inject(GameAudio);
  protected readonly open = signal(false);
  protected readonly meApi = inject(MeApiService);
  protected readonly isAdmin = computed(() => this.meApi.me()?.roles?.includes('Admin') ?? false);

  protected readonly links = [
    { label: '多人鑑定', description: '房間大廳', icon: 'users-round', path: '/game', activePrefixes: ['/game/demo', '/game/rooms', '/game/room'] },
    { label: '單人小遊戲', description: '單人挑戰', icon: 'gamepad-2', path: '/game/training', activePrefixes: ['/game/training', '/game/minigames'] },
    { label: '玩法試玩', description: '先玩再挑戰', icon: 'book-open', path: '/game/how-to', activePrefixes: ['/game/how-to'] },
    { label: '鑑賞回答', description: '讀回答、投一票', icon: 'book-open', path: '/game/appreciation', activePrefixes: ['/game/appreciation'] }
  ] as const;

  constructor() {
    inject(DestroyRef).onDestroy(this.console.attach());
    inject(DestroyRef).onDestroy(this.audio.attach());
    // Q／E 與手把 LB／RB 在四個遊戲分頁之間前後切換。
    this.console.tabStep$.pipe(takeUntilDestroyed()).subscribe(step => {
      const index = this.links.findIndex(link => this.isActive(link));
      const next = this.links[(Math.max(index, 0) + step + this.links.length) % this.links.length];
      void this.router.navigateByUrl(next.path);
    });
  }

  protected isActive(link: (typeof this.links)[number]): boolean {
    const currentPath = this.currentPath();
    return currentPath === link.path || link.activePrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
  }

  protected isTestActive(): boolean {
    const currentPath = this.currentPath();
    return currentPath === '/game/test' || currentPath.startsWith('/game/test/') || this.router.parseUrl(this.router.url).queryParams['test'] === '1';
  }

  protected isDemoActive(): boolean { return this.currentPath() === '/game/demo'; }
  protected lobbyQuery(): Record<string, string> {
    const params = this.router.parseUrl(this.router.url).queryParams;
    return Object.fromEntries(['status', 'sort', 'page'].filter(key => params[key]).map(key => [key, params[key]]));
  }
  protected toggleMenu(event: Event): void { event.stopPropagation(); this.open.update(value => !value); }
  @HostListener('document:click', ['$event']) protected closeMenu(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
  @HostListener('keydown.escape', ['$event']) protected dismissMenu(event: Event): void {
    if (!this.open()) return;
    event.preventDefault(); event.stopPropagation();
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.game-menu')?.focus();
  }
  @HostListener('focusout', ['$event']) protected closeOnFocusOut(event: FocusEvent): void {
    if (event.relatedTarget && !this.host.nativeElement.contains(event.relatedTarget as Node)) this.open.set(false);
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].replace(/\/$/, '') || '/';
  }
}
