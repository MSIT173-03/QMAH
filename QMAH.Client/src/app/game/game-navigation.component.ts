import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

// ui-integration: Game Area 內只保留一條模式與流程子導覽；跨 Area 導航仍由 Global App Shell 負責。
@Component({
  selector: 'app-game-navigation',
  imports: [RouterLink],
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss'
})
export class GameNavigationComponent {
  private readonly router = inject(Router);

  protected readonly links = [
    { label: '多人鑑定', description: '和朋友一起玩', path: '/game', activePrefixes: ['/game/demo', '/game/test', '/game/rooms', '/game/room'] },
    { label: '單人小遊戲', description: '一個人完成短局', path: '/game/training', activePrefixes: ['/game/training', '/game/minigames'] },
    { label: '玩法說明', description: '先看懂流程', path: '/game/how-to', activePrefixes: ['/game/how-to'] }
  ] as const;

  protected isActive(link: (typeof this.links)[number]): boolean {
    const currentPath = this.router.url.split('?')[0].replace(/\/$/, '') || '/';
    return currentPath === link.path || link.activePrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
  }
}
