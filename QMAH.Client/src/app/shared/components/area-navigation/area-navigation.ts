import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * 五個既有 Area 的最小共用入口。
 * 這裡只負責跨頁導覽，不重複登入／角色判斷；會員與管理路由仍由既有 guard／API 權限處理。
 */
@Component({
  selector: 'app-area-navigation',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './area-navigation.html',
  styleUrl: './area-navigation.scss',
})
export class AreaNavigationComponent {
  /** 路徑皆為 develop 已存在的正式 route，集中維護避免各 Area 各自寫錯入口。 */
  protected readonly links = [
    { label: '會員中心', path: '/member' },
    { label: '圖鑑', path: '/artifact-list' },
    { label: '遊戲', path: '/game' },
    { label: '社群', path: '/social/posts' },
    { label: '商城', path: '/store' },
  ] as const;
}
