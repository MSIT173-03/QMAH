import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberTitle } from '../../../shared/member-title/member-title';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  OnInit,
  inject
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
import { NotificationLive } from '../../../core/services/notification-live';


interface EconomyResponse {
  pointBalance: number;
  keyProgressBalance: number;
  keyProgressToNormalKey: number;
}

interface LedgerRow {
  id: string;
  amount: number;
  reason: string;
  itemName: string | null;
  createdAt: string;
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
    MemberTitle,
    RouterLink,
    CommonModule,
    BackToMember,
    QmahIconComponent,
    KeyList,
  ],

  templateUrl: './economy.html',
  styleUrl: './economy.scss'
})
export class Economy implements OnInit {
  private readonly live = inject(NotificationLive);
  /** 從商城頂部「點數」連結過來（?from=store）：頂部改成返回商城的橫幅 */
  protected readonly fromStore = inject(ActivatedRoute).snapshot.queryParamMap.get('from') === 'store';
  private initialized = false;
  private refreshingRealtime = false;
  private pendingRealtimeRefresh = false;

  economy: EconomyResponse | null = null;

  /** 流水：預設收合，第一次展開才載入；可切點數／鑰匙、篩日期區間、分頁與跳頁 */
  ledgerOpen = true;
  ledgerKind: 'points' | 'keys' = 'points';
  ledgerRows: LedgerRow[] = [];
  ledgerTotal = 0;
  ledgerLoading = false;
  ledgerPage = 1;
  ledgerFrom = '';
  ledgerTo = '';
  ledgerJump = '';
  readonly ledgerPageSize = 10;
  /** 快速區間：近 N 天（0 代表全部） */
  readonly ledgerRanges = [
    { label: '全部', days: 0 },
    { label: '近 7 天', days: 7 },
    { label: '近 30 天', days: 30 },
    { label: '近 90 天', days: 90 },
  ];

  get ledgerPages(): number {
    return Math.max(1, Math.ceil(this.ledgerTotal / this.ledgerPageSize));
  }

  /** 頁碼列：第一頁、最後一頁與目前頁前後各兩頁，中間以省略號隔開 */
  get ledgerPageList(): (number | '…')[] {
    const last = this.ledgerPages;
    const keep = new Set([1, last]);
    for (let n = this.ledgerPage - 2; n <= this.ledgerPage + 2; n++) if (n >= 1 && n <= last) keep.add(n);
    const sorted = [...keep].sort((x, y) => x - y);
    const list: (number | '…')[] = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) list.push('…');
      list.push(n);
    });
    return list;
  }

  get ledgerActiveDays(): number | null {
    if (!this.ledgerFrom || this.ledgerTo !== this.dateString(new Date())) return this.ledgerFrom || this.ledgerTo ? null : 0;
    const diff = Math.round((Date.now() - new Date(this.ledgerFrom + 'T00:00:00').getTime()) / 86_400_000);
    return this.ledgerRanges.some((r) => r.days === diff) ? diff : null;
  }

  private dateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  onCouponRedeemed(remaining: number): void {
    if (this.economy) this.economy = { ...this.economy, pointBalance: remaining };
    this.cdr.markForCheck();
  }

  onLedgerToggle(event: Event): void {
    this.ledgerOpen = (event.target as HTMLDetailsElement).open;
    if (this.ledgerOpen && this.ledgerRows.length === 0 && !this.ledgerLoading) {
      this.loadLedger(1);
    }
  }

  setLedgerKind(kind: 'points' | 'keys'): void {
    if (this.ledgerKind === kind) return;
    this.ledgerKind = kind;
    this.loadLedger(1);
  }

  setLedgerRange(days: number): void {
    if (days === 0) {
      this.ledgerFrom = '';
      this.ledgerTo = '';
    } else {
      const from = new Date();
      from.setDate(from.getDate() - days);
      this.ledgerFrom = this.dateString(from);
      this.ledgerTo = this.dateString(new Date());
    }
    this.loadLedger(1);
  }

  onLedgerDate(which: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (which === 'from') this.ledgerFrom = value;
    else this.ledgerTo = value;
    this.loadLedger(1);
  }

  goLedgerPage(page: number): void {
    const target = Math.min(this.ledgerPages, Math.max(1, Math.floor(page) || 1));
    this.ledgerJump = '';
    if (target !== this.ledgerPage) this.loadLedger(target);
  }

  loadLedger(page: number): void {
    this.ledgerPage = page;
    this.ledgerLoading = true;
    const params: Record<string, string | number> = { kind: this.ledgerKind, page, pageSize: this.ledgerPageSize };
    if (this.ledgerFrom) params['from'] = this.ledgerFrom;
    if (this.ledgerTo) params['to'] = this.ledgerTo;
    this.http
      .get<{ total: number; items: LedgerRow[] }>(`${environment.apiBaseUrl}/me/economy/ledger`, { params })
      .pipe(
        catchError(() => of({ total: 0, items: [] as LedgerRow[] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.ledgerRows = result.items;
        this.ledgerTotal = result.total;
        this.ledgerLoading = false;
        this.cdr.markForCheck();
      });
  }

  /** 流水原因的顯示文字：系統代碼轉成中文，其餘原因本身就是中文敘述 */
  ledgerReason(row: LedgerRow): string {
    const map: Record<string, string> = {
      ADMIN_GRANT: '管理員發放',
      ARTIFACT_UNLOCK: '解鎖圖鑑文物',
      ILLEGAL_CONTENT: '內容違規處置',
    };
    return map[row.reason] ?? row.reason.replace(/^展示資料：/, '');
  }

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
    this.loadLedger(1);
    this.live.economyChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.initialized || this.loading) {
        this.pendingRealtimeRefresh = true;
        return;
      }
      this.refreshBalances();
    });
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

  /** 鑰匙進度的視覺階段（0～4，每 20% 一階）：色相、光暈與進度條質感隨階段明顯不同 */
  get keyTier(): number {
    return Math.min(4, Math.floor(this.keyProgressPercent / 20));
  }

  get keyProgressRatio(): number {
    return this.keyProgressPercent / 100;
  }

  /** 點數的視覺階段（0～7）：門檻不明說，畫面上只以光暈、寶石數量與質感逐段變化 */
  get pointTier(): number {
    const points = this.economy?.pointBalance ?? 0;
    const thresholds = [100, 500, 1000, 5000, 20000, 100000, 500000];
    return thresholds.filter((limit) => points >= limit).length;
  }

  /** 沿用舊的四段（文案與既有樣式用） */
  get pointLevel(): 'starter' | 'growing' | 'abundant' | 'treasury' {
    const tier = this.pointTier;
    return tier >= 3 ? 'treasury' : tier >= 2 ? 'abundant' : tier >= 1 ? 'growing' : 'starter';
  }

  get pointLevelLabel(): string {
    return ['慢慢累積', '累積有成', '點數充裕', '小有積蓄', '財力雄厚', '富甲一方', '寶庫滿溢', '傳說寶庫'][this.pointTier];
  }

  get pointGems(): number[] {
    return Array.from({ length: Math.min(9, 1 + this.pointTier * 1.2 + (this.pointTier > 0 ? 1 : 0)) | 0 }, (_, index) => index);
  }

  get isKeyAlmostReady(): boolean {
    return this.keyProgressPercent >= 80 && this.remainingKeyProgress > 0;
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
          this.initialized = true;

          this.cdr.detectChanges();
          this.flushPendingRefresh();
        },

        error: (error) => {

          this.errorMessage =
            '讀取點數與鑰匙資料失敗，請重試。';

          this.loading = false;
          this.initialized = true;

          this.cdr.detectChanges();
          this.flushPendingRefresh();
        }

      });
  }

  /** 即時推播只讀餘額，不重跑首次載入時的進度轉換 POST。 */
  private refreshBalances(): void {
    if (this.refreshingRealtime) {
      this.pendingRealtimeRefresh = true;
      return;
    }
    this.refreshingRealtime = true;
    this.http.get<EconomyResponse>(`${environment.apiBaseUrl}/me/economy`).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: data => {
        this.economy = data;
        this.refreshingRealtime = false;
        this.cdr.detectChanges();
        this.flushPendingRefresh();
      },
      error: () => {
        this.refreshingRealtime = false;
        this.flushPendingRefresh();
      }
    });
  }

  private flushPendingRefresh(): void {
    if (!this.pendingRealtimeRefresh || this.loading || this.refreshingRealtime) return;
    this.pendingRealtimeRefresh = false;
    this.refreshBalances();
  }
}
