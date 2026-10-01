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

import {
  QmahIconComponent
} from '../../../shared/components/qmah-icon/qmah-icon';

import {
  keyAssetPath
} from '../../../shared/key-assets';

import {
  KeyScopeType
} from '../../../models/key-model';

// 共用鑰匙背包元件
import {
  KeyList
} from '../../../key-list/key-list';


interface EconomyResponse {
  pointBalance: number;
  keyProgressBalance: number;
  keyProgressToNormalKey: number;
}


@Component({
  selector: 'app-economy',

  imports: [
    CommonModule,
    BackToMember,
    QmahIconComponent,
    KeyList
  ],

  templateUrl: './economy.html',
  styleUrl: './economy.scss'
})
export class Economy implements OnInit {

  economy: EconomyResponse | null = null;

  loading = true;
  errorMessage = '';


  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {
    this.loadEconomy();
  }


  // ===============================
  // 探索鑰匙累積進度百分比
  // ===============================

  get keyProgressPercent(): number {

    if (!this.economy) {
      return 0;
    }

    const balance =
      this.economy.keyProgressBalance;

    const target =
      this.economy.keyProgressToNormalKey;

    if (target <= 0) {
      return 0;
    }

    return Math.min(
      Math.max(
        (balance / target) * 100,
        0
      ),
      100
    );
  }


  // ===============================
  // 進度條比例 0 ~ 1
  // ===============================

  get keyProgressRatio(): number {
    return this.keyProgressPercent / 100;
  }


  // ===============================
  // 距離下一把探索鑰匙
  // ===============================

  get remainingKeyProgress(): number {

    if (!this.economy) {
      return 0;
    }

    return Math.max(
      this.economy.keyProgressToNormalKey -
      this.economy.keyProgressBalance,
      0
    );
  }


  // ===============================
  // 鑰匙圖片
  // ===============================

  keyAssetPath(
    scopeType: KeyScopeType
  ): string {

    return keyAssetPath(scopeType);
  }


  // ===============================
  // 讀取會員資產
  // ===============================

  private loadEconomy(): void {

    this.loading = true;
    this.errorMessage = '';

    this.http
      .get<EconomyResponse>(
        '/api/v1/me/economy'
      )
      .subscribe({

        next: (data) => {

          this.economy = data;
          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'economy error:',
            error
          );

          this.errorMessage =
            '讀取點數與鑰匙資料失敗';

          this.loading = false;

          this.cdr.detectChanges();
        }

      });
  }
}
