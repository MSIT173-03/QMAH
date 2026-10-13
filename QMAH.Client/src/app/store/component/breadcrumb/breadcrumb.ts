import { Component, computed, input } from '@angular/core';
import { StoreLink } from '../../shared/store-link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * 麵包屑導覽列：依序顯示頁面階層路徑，最後一項為目前頁面（不可點擊），其餘項目可點擊返回上層頁面。
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [StoreLink],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
})
export class Breadcrumb {
  /** 麵包屑項目清單，最後一項會顯示為目前頁面（不可點擊），其餘項目需附上 href */
  items = input<BreadcrumbItem[]>([]);

  /** 上一層（倒數第二項）；只有一層時不顯示返回鈕 */
  protected readonly parent = computed(() => this.items().at(-2) ?? null);
}
