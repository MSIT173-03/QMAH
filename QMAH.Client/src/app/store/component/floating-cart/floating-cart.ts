import { Component, ElementRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { LucideShoppingBag } from '@lucide/angular';
import { formatMoney } from '../../shared/format';
import { MemberApi } from '../../api/member.api';
import { Coupon } from '../../api/api.models';
import { cartSuggestion } from '../../shared/coupon-saving';
import { CART_PATH, CHECKOUT_PATH, productPath } from '../../shared/paths';
import { CartState } from '../../shared/page-state';
import { StoreLink } from '../../shared/store-link';
import { QtyStepper } from '../qty-stepper/qty-stepper';

/** 懸浮面板最多列出的品項數，超過的部分合併成一行說明 */
const PANEL_MAX_ITEMS = 4;
/** 捲動超過這個距離（像素）才顯示懸浮購物車 */
const SHOW_AFTER_PX = 420;

/**
 * 懸浮購物車：固定在視窗左下角的按鈕，顯示件數；點開後在上方展開快覽面板，
 * 可直接調整數量、移除品項，並看到應付金額與前往購物車／結帳的入口。
 * 與頁面共用同一份購物車狀態（由頁面傳入），因此在此改動數量後，頂部列與頁面其他區塊會同步更新。
 * 未登入時不顯示內容，改為提示登入；按 Esc 或點面板以外的地方關閉。
 */
@Component({
  selector: 'app-floating-cart',
  imports: [LucideShoppingBag, QtyStepper, StoreLink],
  templateUrl: './floating-cart.html',
  styleUrl: './floating-cart.scss',
})
export class FloatingCart {
  /** 頁面持有的購物車狀態（injectCartState） */
  cart = input.required<CartState>();

  protected readonly cartHref = CART_PATH;
  protected readonly checkoutHref = CHECKOUT_PATH;
  protected readonly open = signal(false);

  /** 目前持有的折價券：第一次展開面板才載入，平常不多打一支 API */
  private readonly memberApi = inject(MemberApi);
  private readonly couponSource = signal(false);
  private readonly coupons = toSignal(
    toObservable(this.couponSource).pipe(switchMap((on) => (on ? this.memberApi.getCoupons() : EMPTY))),
    { initialValue: [] as Coupon[] },
  );

  /**
   * 結帳建議：
   * 1. 有門檻已達的折價券 → 推薦折抵最多的那張，並預估折後應付；
   * 2. 否則找「再買一點就能用」的券（差額 500 元內）；
   * 3. 點數可直接折抵小額（後端上限 50 點、不超過金額 5%），一併提示。
   */
  protected readonly suggestion = computed(() => cartSuggestion(this.coupons(), this.cart().cart()?.amounts.payable ?? 0));
  /** 頁面是否已向下捲動；在頁首附近時頂部列已有購物車入口，懸浮按鈕不顯示 */
  protected readonly scrolled = signal(typeof window !== 'undefined' && window.scrollY > SHOW_AFTER_PX);
  protected readonly items = computed(() => this.cart().cart()?.items ?? []);
  protected readonly visibleItems = computed(() => this.items().slice(0, PANEL_MAX_ITEMS));
  protected readonly restCount = computed(() => Math.max(0, this.items().length - PANEL_MAX_ITEMS));
  protected readonly payable = computed(() => formatMoney(this.cart().cart()?.amounts.payable ?? 0));
  /** 滿額免運門檻，與後端 CheckoutDtos.FreeShippingThreshold 一致（依商品金額、折價券前計算） */
  private readonly freeShippingThreshold = 1500;
  protected readonly shippingHint = computed(() => {
    const amount = this.cart().cart()?.amounts.payable ?? 0;
    const left = this.freeShippingThreshold - amount;
    return left > 0 ? `再買 ${formatMoney(left)} 享免運` : '已享免運';
  });
  protected readonly shippingPercent = computed(() =>
    Math.min(100, ((this.cart().cart()?.amounts.payable ?? 0) / this.freeShippingThreshold) * 100));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);

  protected productHref(id: string): string {
    return productPath(id);
  }

  protected money(value: number): string {
    return formatMoney(value);
  }

  protected toggle(): void {
    this.open.update((value) => !value);
    if (this.open()) this.couponSource.set(true);
  }

  /** 未登入時按「登入後查看」：沿用購物車的登入提示，登入後回到購物車頁 */
  protected onSignIn(): void {
    this.cart().requireSignIn(() => this.router.navigateByUrl(CART_PATH));
  }

  /** 調整數量；數量減至 0 由 QtyStepper 的最小值（1）擋下，移除請用按鈕 */
  protected onQty(productId: string, qty: number): void {
    this.cart().update(productId, qty);
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    const scrolled = window.scrollY > SHOW_AFTER_PX;
    if (scrolled !== this.scrolled()) this.scrolled.set(scrolled);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event.target'])
  protected onDocumentClick(target: EventTarget | null): void {
    if (this.open() && !this.host.nativeElement.contains(target as Node)) this.open.set(false);
  }
}
