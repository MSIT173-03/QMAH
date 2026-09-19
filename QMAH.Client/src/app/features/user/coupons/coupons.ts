import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import {
  BackToMember
} from '../../../shared/back-to-member/back-to-member';


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
    CommonModule,
    BackToMember
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
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {
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
  // 篩選後優惠券
  // ===============================

  get filteredCoupons(): MemberCoupon[] {

    if (
      this.selectedStatus === 'ALL'
    ) {
      return this.coupons;
    }


    return this.coupons.filter(
      coupon =>
        coupon.status ===
        this.selectedStatus
    );

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
        return '全部優惠券';

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

          // integration: 優惠券清單不需在 console 留存，避免正式環境輸出會員資產資料。
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
            '讀取優惠券資料失敗';

          this.loading = false;

          this.cdr.detectChanges();

        }

      });

  }

}
