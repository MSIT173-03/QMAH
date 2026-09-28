import { Component, input, output } from '@angular/core';
import { StoreLink } from '../../shared/store-link';

/**
 * 空狀態顯示元件：用於清單無資料時的提示畫面，顯示標題與說明文字，並可搭配連結或按鈕呈現行動呼籲。
 */
@Component({
  selector: 'app-empty-state',
  imports: [StoreLink],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  /** 標題文字 */
  title = input('');
  /** 說明文字 */
  desc = input('');
  /** 行動按鈕文字 */
  ctaLabel = input('');
  /** 行動按鈕連結網址（ctaMode 為 link 時使用） */
  ctaHref = input<string | null>(null);
  /** link：導向其他頁面；button：在本頁執行動作（例如清除篩選），改以 ctaClick 通知外部 */
  ctaMode = input<'link' | 'button'>('link');
  /** 較大版型（例如購物車頁的空狀態），影響留白與按鈕間距 */
  size = input<'default' | 'lg'>('default');

  /** ctaMode 為 button 時，點擊行動按鈕觸發 */
  ctaClick = output<void>();
}
