import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { MemberTitle } from '../../../shared/member-title/member-title';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import {
  BackToMember
} from '../../../shared/back-to-member/back-to-member';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { compareCouponOff, couponToneOf } from '../../../store/shared/coupon-tone';
import { MemberApi } from '../../../store/api/member.api';
import { CouponExchange } from '../../member/economy/coupon-exchange/coupon-exchange';


interface MemberCoupon {
  id: string;
  code: string;
  name: string;
  acquisitionType: string;
  pointCost: number | null;
  discountType: string;
  discountValue: number;
  minimumAmount: number;
  startAt: string;
  endAt: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}


@Component({
  selector: 'app-coupons',

  imports: [
    MemberTitle,
    CommonModule,
    BackToMember,
    QmahIconComponent,
    CouponExchange
  ],

  templateUrl: './coupons.html',
  styleUrl: './coupons.scss'
})
export class Coupons implements OnInit {

  coupons: MemberCoupon[] = [];

  loading = true;
  errorMessage = '';

  selectedStatus:
    'ALL' |
    'AVAILABLE' |
    'USED' |
    'EXPIRED' = 'ALL';


  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private memberApi: MemberApi
  ) { }

  /** 目前點數（折價券兌換用）；兌換成功後由兌換元件帶回扣除後的餘額 */
  points = 0;


  ngOnInit(): void {
    this.memberApi.getProfile().subscribe({ next: (p) => { this.points = p.pointBalance; this.cdr.markForCheck(); }, error: () => undefined });
    this.loadCoupons();
  }


  // ===============================
  // 數量統計
  // ===============================

  get availableCount(): number {

    return this.coupons.filter(
      coupon =>
        coupon.status === 'AVAILABLE'
    ).length;

  }


  get usedCount(): number {

    return this.coupons.filter(
      coupon =>
        coupon.status === 'USED'
    ).length;

  }


  get expiredCount(): number {

    return this.coupons.filter(
      coupon =>
        coupon.status === 'EXPIRED'
    ).length;

  }


  get revokedCount(): number {

    return this.coupons.filter(
      coupon =>
        coupon.status === 'REVOKED'
    ).length;

  }


  // ===============================
  // 篩選後折價券
  // ===============================

  get filteredCoupons(): MemberCoupon[] {
    const list = this.selectedStatus === 'ALL' ? this.coupons : this.coupons.filter((coupon) => coupon.status === this.selectedStatus);
    // 可使用的排前面、快到期的最前；其餘維持原順序
    const rank = (coupon: MemberCoupon) => (coupon.status === 'AVAILABLE' ? 0 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b) || new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime() || compareCouponOff(this.offText(a), this.offText(b)));
  }

  /** 預設先顯示的張數（三欄兩排以上），其餘展開 */
  readonly previewCount = 8;
  expanded = false;

  get visibleCoupons(): MemberCoupon[] {
    return this.expanded ? this.filteredCoupons : this.filteredCoupons.slice(0, this.previewCount);
  }

  toneOf(coupon: MemberCoupon) {
    return couponToneOf(this.offText(coupon));
  }

  /** 票券左塊的大字：折扣券「15% OFF」、現金券「NT$300」，與商城票券一致 */
  offText(coupon: MemberCoupon): string {
    return ['PERCENTAGE', 'PERCENT'].includes(coupon.discountType) ? `${coupon.discountValue}% OFF` : `NT$${coupon.discountValue}`;
  }


  // ===============================
  // 切換篩選
  // ===============================

  selectStatus(
    status:
      'ALL' |
      'AVAILABLE' |
      'USED' |
      'EXPIRED'
  ): void {

    this.selectedStatus = status;

  }


  // ===============================
  // 篩選名稱
  // ===============================

  get selectedStatusLabel(): string {

    switch (
    this.selectedStatus
    ) {

      case 'AVAILABLE':
        return '可使用';

      case 'USED':
        return '已使用';

      case 'EXPIRED':
        return '已過期';

      default:
        return '全部折價券';

    }

  }


  // ===============================
  // 狀態文字
  // ===============================

  getStatusLabel(
    status: string
  ): string {

    switch (status) {

      case 'AVAILABLE':
        return '可使用';

      case 'USED':
        return '已使用';

      case 'EXPIRED':
        return '已過期';

      case 'REVOKED':
        return '已撤銷';

      default:
        return status;

    }

  }


  // ===============================
  // 取得方式
  // ===============================

  getAcquisitionTypeLabel(
    type: string
  ): string {

    switch (type) {

      case 'POINT_REDEEM':
      case 'POINT_EXCHANGE':
        return '點數兌換';

      case 'ADMIN_GRANT':
        return '活動發放';

      case 'SYSTEM_GRANT':
        return '系統發放';

      default:
        return type;

    }

  }


  // ===============================
  // 折扣顯示
  // ===============================

  getDiscountLabel(
    coupon: MemberCoupon
  ): string {

    switch (
    coupon.discountType
    ) {

      case 'PERCENTAGE':
      case 'PERCENT':

        return `${coupon.discountValue}% OFF`;


      case 'FIXED_AMOUNT':
      case 'FIXED':
      case 'AMOUNT':

        return `折抵 $${coupon.discountValue}`;


      default:

        return `${coupon.discountValue}`;

    }

  }


  // ===============================
  // 最低消費顯示
  // ===============================

  getMinimumLabel(
    coupon: MemberCoupon
  ): string {

    if (
      coupon.minimumAmount > 0
    ) {

      return `滿 $${coupon.minimumAmount} 可使用`;

    }


    return '無最低消費門檻';

  }


  // ===============================
  // 是否即將到期
  // 7 天內
  // ===============================

  isExpiringSoon(
    coupon: MemberCoupon
  ): boolean {

    if (
      coupon.status !== 'AVAILABLE'
    ) {
      return false;
    }


    const now =
      new Date();

    const expireDate =
      new Date(coupon.expiresAt);


    const diff =
      expireDate.getTime() -
      now.getTime();


    const days =
      diff /
      (
        1000 *
        60 *
        60 *
        24
      );


    return (
      days >= 0 &&
      days <= 7
    );

  }


  // ===============================
  // 剩餘天數
  // ===============================

  getRemainingDays(
    coupon: MemberCoupon
  ): number {

    const now =
      new Date();

    const expireDate =
      new Date(coupon.expiresAt);


    const diff =
      expireDate.getTime() -
      now.getTime();


    return Math.max(
      0,
      Math.ceil(
        diff /
        (
          1000 *
          60 *
          60 *
          24
        )
      )
    );

  }


  // ===============================
  // API
  // ===============================

  private loadCoupons(): void {

    this.loading = true;

    this.errorMessage = '';


    this.http
      .get<MemberCoupon[]>(
        '/api/v1/me/coupons'
      )
      .subscribe({

        next: (
          data: MemberCoupon[]
        ) => {

          // integration: 折價券清單不需在 console 留存，避免正式環境輸出會員資產資料。
          // console.log('coupons:', data);

          this.coupons = data;

          this.loading = false;

          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'coupons error:',
            error
          );

          this.errorMessage =
            '讀取折價券資料失敗';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }

}
