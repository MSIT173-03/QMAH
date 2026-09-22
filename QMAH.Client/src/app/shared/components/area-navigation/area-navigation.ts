import { Component, Type, inject, input, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import {
  LucideBookOpen,
  LucideGamepad2,
  LucideMessageCircle,
  LucideShoppingBag,
  LucideUserRound,
} from '@lucide/angular';

export interface NavigationItem {
  label: string;
  path: string;
  activePrefixes: readonly string[];
  /** Lucide icon component keeps the same 24px outline language in every navigation level. */
  icon?: Type<unknown>;
  badge?: string | number;
}

export interface NavigationGroup {
  label: string;
  items: readonly NavigationItem[];
  tone?: 'default' | 'admin';
}

/**
 * 五個既有 Area 的最小共用入口；顯示名稱統一為四字，讓 Desktop／Mobile 導覽保持相同節奏。
 * 這裡只負責跨頁導覽，不重複登入／角色判斷；會員與管理路由仍由既有 guard／API 權限處理。
 */
@Component({
  selector: 'app-area-navigation',
  standalone: true,
  imports: [RouterLink, NgComponentOutlet],
  templateUrl: './area-navigation.html',
  styleUrl: './area-navigation.scss',
})
export class AreaNavigationComponent {
  private readonly router = inject(Router);

  /** Desktop 放在 App Shell header；Mobile 放在可收合 drawer，避免同時渲染兩套可見主導航。 */
  readonly variant = input<'desktop' | 'mobile'>('desktop');

  /** Mobile 可選擇傳入次級群組；元件只負責呈現，不把 Social／Admin 寫死在 App Shell。 */
  readonly groups = input<readonly NavigationGroup[]>([]);

  /** 點選目前 route 也要能讓 drawer 收起，避免 mobile navigation 卡在畫面上。 */
  readonly itemSelected = output<void>();

  /** 路徑皆為 main 已存在的正式 route，集中維護避免各 Area 各自寫錯入口。 */
  protected readonly links: readonly NavigationItem[] = [
    {
      label: '會員中心',
      path: '/member',
      activePrefixes: ['/member'],
      icon: LucideUserRound,
    },
    {
      label: '圖鑑鑰匙',
      path: '/artifact-list',
      activePrefixes: ['/artifact-list', '/key-list'],
      icon: LucideBookOpen,
    },
    {
      label: '遊戲大廳',
      path: '/game',
      activePrefixes: ['/game'],
      icon: LucideGamepad2,
    },
    {
      label: '社群廣場',
      path: '/social/posts',
      activePrefixes: ['/social'],
      icon: LucideMessageCircle,
    },
    {
      label: '購物商城',
      path: '/store',
      activePrefixes: ['/store'],
      icon: LucideShoppingBag,
    },
  ];

  protected isActive(link: NavigationItem): boolean {
    const currentPath = this.router.url.split('?')[0].replace(/\/$/, '') || '/';
    return link.activePrefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
  }

  protected notifyItemSelected(): void { this.itemSelected.emit(); }
}
