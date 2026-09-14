import { Component, computed, input, signal } from '@angular/core';
import { StoreLink } from '../../shared/store-link';
import { Coupon } from '../../api/api.models';
import { formatDateMD, formatMoney } from '../../shared/format';

/**
 * 頁面頂部工具列：左側輪播跑馬燈公告，右側提供訂單查詢、個人頁面、點數與折價券等帳戶捷徑連結，
 * 並可展開折價券懸浮面板檢視目前可用的折價券清單。
 */
@Component({
  selector: 'app-promobar',
  imports: [StoreLink],
  templateUrl: './promobar.html',
  styleUrls: [
    './promobar.scss',
  ],
})
export class Promobar {
  /** 跑馬燈公告文字清單 */
  announcements = input<string[]>([]);

  /** 「訂單查詢」連結網址 */
  ordersHref = input('#');
  /** 「個人頁面」連結網址 */
  profileHref = input('#');
  /** 「點數」連結網址 */
  pointsHref = input('#');
  /** 目前點數顯示文字 */
  points = input('0');

  /** 「折價券」連結網址 */
  couponsHref = input('#');
  /** 折價券面板中「管理所有折價券」連結網址 */
  manageCouponsHref = input('#');
  /** 折價券清單資料 */
  coupons = input<Coupon[]>([]);

  /** 折價券懸浮面板的顯示資料：使用門檻與到期日合併為一行說明 */
  protected couponRows = computed(() =>
    this.coupons().map((coupon) => {
      const threshold = coupon.min > 0 ? `滿 ${formatMoney(coupon.min)}` : '不限金額';
      return {
        off: coupon.off,
        title: coupon.title,
        meta: coupon.due ? `${threshold} · ${formatDateMD(coupon.due)} 到期` : threshold,
      };
    }),
  );

  /** 折價券懸浮面板是否展開 */
  protected open = signal(false);
}
