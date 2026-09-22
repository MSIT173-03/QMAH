import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MeApiService } from '../../core/services/me-api';
import { QmahIconComponent, QmahIconName } from '../../shared/components/qmah-icon/qmah-icon';

interface HomeRouteLink {
  label: string;
  description: string;
  path: string;
  icon: QmahIconName;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, QmahIconComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  readonly meApi = inject(MeApiService);

  // ui-integration: 首頁只整理既有 Area 的真實入口，不另外創造不存在的活動、推薦數據或假進度。
  readonly routeLinks: readonly HomeRouteLink[] = [
    {
      label: '文物圖鑑',
      description: '依年代與分類查找館藏，打開一件作品的故事。',
      path: '/artifact-list',
      icon: 'book-open',
    },
    {
      label: '遊戲大廳',
      description: '用互動挑戰複習文物知識，從練習開始也可以。',
      path: '/game',
      icon: 'gamepad-2',
    },
    {
      label: '社群廣場',
      description: '看看貼文、活動與站方公告，和其他玩家交流。',
      path: '/social/posts',
      icon: 'message-circle',
    },
    {
      label: '購物商城',
      description: '瀏覽現有文物周邊與館藏靈感商品。',
      path: '/store',
      icon: 'shopping-bag',
    },
    {
      label: '會員中心',
      description: '登入後保存圖鑑進度，管理鑰匙與會員資料。',
      path: '/member',
      icon: 'user-round',
    },
  ];
}
