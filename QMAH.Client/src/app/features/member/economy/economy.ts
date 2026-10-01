import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

interface KeyProgressConversion {
  convertedNormalKeys: number;
  consumedKeyProgress: number;
  remainingKeyProgress: number;
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
  conversionError = '';
  conversion: KeyProgressConversion | null = null;
  @ViewChild('conversionDialog') private conversionDialog!: ElementRef<HTMLDialogElement>;


  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
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

  loadEconomy(): void {

    if (this.loading && this.economy) return;

    this.loading = true;
    this.errorMessage = '';
    this.conversionError = '';

    this.http
      .post<KeyProgressConversion>(
        `${environment.apiBaseUrl}/me/keys/convert-progress`, {}
      )
      .pipe(
        tap(result => {
          // 只在後端實際入帳後提醒，未達標或重整頁面不重複彈窗。
          if (result.convertedNormalKeys > 0) {
            this.conversion = result;
            this.cdr.detectChanges();
            this.conversionDialog.nativeElement.showModal();
          }
        }),
        catchError(error => {
          this.conversionError = error.error?.detail
            || '暫時無法轉換探索鑰匙。你的進度已保留，請重試。';
          return of(null);
        }),
        switchMap(() => this.http.get<EconomyResponse>(`${environment.apiBaseUrl}/me/economy`)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: (data) => {

          this.economy = data;
          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (error) => {

          this.errorMessage =
            '讀取點數與鑰匙資料失敗，請重試。';

          this.loading = false;

          this.cdr.detectChanges();
        }

      });
  }
}
