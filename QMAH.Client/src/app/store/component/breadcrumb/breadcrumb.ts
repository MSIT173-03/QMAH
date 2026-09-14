import { Component, input } from '@angular/core';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * 麵包屑導覽列：依序顯示頁面階層路徑，最後一項為目前頁面（不可點擊），其餘項目可點擊返回上層頁面。
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [],
  templateUrl: './breadcrumb.html',
  styleUrls: [
    './breadcrumb.scss',
  ],
})
export class Breadcrumb {
  /** 麵包屑項目清單，最後一項會顯示為目前頁面（不可點擊），其餘項目需附上 href */
  items = input<BreadcrumbItem[]>([]);
}
