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
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';


interface EconomyKey {
  id: string;
  code: string;
  name: string;
  scopeType: string;
  categoryId: string | null;
  eraBucketId: string | null;
  balance: number;
  eligibleArtifactCount: number;
  recyclePointValue: number;
}


interface EconomyResponse {
  pointBalance: number;

  keyProgressBalance: number;
  keyProgressToNormalKey: number;

  keys: EconomyKey[];
}


type KeyFilter =
  | 'ALL'
  | 'NORMAL'
  | 'CATEGORY'
  | 'ERA'
  | 'UNIVERSAL';


@Component({
  selector: 'app-economy',

  imports: [
    CommonModule,
    BackToMember,
    QmahIconComponent
  ],

  templateUrl: './economy.html',
  styleUrl: './economy.scss'
})
export class Economy implements OnInit {

  economy: EconomyResponse | null = null;

  loading = true;
  errorMessage = '';

  selectedFilter: KeyFilter = 'ALL';


  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit(): void {
    this.loadEconomy();
  }


  // ===============================
  // 一般鑰匙累積進度
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

  /**
   * ui-integration: 進度條以 transform 呈現比例，避免每次資料更新都觸發 width layout
   * 重排；保留原本的百分比計算與視覺回饋，不改變會員資產契約。
   */
  get keyProgressRatio(): number {
    return this.keyProgressPercent / 100;
  }

  /**
   * ui-integration: 以玩家任務語意取代後端 scope 名稱，讓四種鑰匙在會員與圖鑑頁
   * 使用同一套稱呼；API enum 仍維持原值，避免牽動既有資料與解鎖流程。
   */
  keyScopeLabel(scopeType: string): string {
    return {
      NORMAL: '探索鑰匙',
      CATEGORY: '分類鑰匙',
      ERA: '年代鑰匙',
      UNIVERSAL: '萬能鑰匙',
    }[scopeType] ?? '鑰匙';
  }

  keyScopeDescription(scopeType: string): string {
    return {
      NORMAL: '從尚未解鎖的文物中探索一件',
      CATEGORY: '從指定分類探索一件文物',
      ERA: '從指定年代探索一件文物',
      UNIVERSAL: '由你指定一件文物解鎖',
    }[scopeType] ?? '用於解鎖圖鑑文物';
  }


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
  // 鑰匙篩選
  // ===============================

  get filteredKeys(): EconomyKey[] {

    if (!this.economy) {
      return [];
    }

    if (this.selectedFilter === 'ALL') {
      return this.economy.keys;
    }

    return this.economy.keys.filter(
      key =>
        key.scopeType ===
        this.selectedFilter
    );
  }


  setFilter(filter: KeyFilter): void {
    this.selectedFilter = filter;
  }


  getFilterCount(filter: KeyFilter): number {

    if (!this.economy) {
      return 0;
    }

    if (filter === 'ALL') {
      return this.economy.keys.length;
    }

    return this.economy.keys.filter(
      key =>
        key.scopeType === filter
    ).length;
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

          // integration: 會員資產已由畫面狀態呈現，先註解原本的資料除錯輸出，避免洩漏帳戶內容。
          // console.log('economy:', data);

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
