import { Component, ElementRef, HostListener, computed, inject, output, signal, viewChild } from '@angular/core';

/** 滑鼠離開觸發連結與面板超過這個距離（像素）才收合；短距離晃出去、斜著移動都不會關 */
const CLOSE_DISTANCE_PX = 140;

/** 同一時間只開一個面板：滑到另一個連結時直接換，不會兩個疊在一起 */
const activePanel = signal<PromobarPanel | null>(null);

/**
 * 頂部工具列（promobar）的懸浮面板：滑鼠移入觸發連結時展開，改為「滑到別的連結就換」、
 * 「點面板以外的地方、按 Esc、或滑鼠離開超過一段距離」才收合，不再一移開就消失。
 * 面板錨定在頁首那一排的下緣，折價券、購物車、訂單共用。使用時以 `panelTrigger` 標出觸發連結，其餘內容投影進面板：
 *
 *   <app-promobar-panel>
 *     <a panelTrigger …>購物車</a>
 *     <a …>面板內的列</a>
 *   </app-promobar-panel>
 */
@Component({
  selector: 'app-promobar-panel',
  templateUrl: './promobar-panel.html',
  styleUrl: './promobar-panel.scss',
})
export class PromobarPanel {
  /** 面板是否展開（同時只有一個面板為展開） */
  protected readonly open = computed(() => activePanel() === this);
  /** 每次展開時通知外層（例如訂單面板在第一次展開才載入資料） */
  readonly opened = output<void>();

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected show(): void {
    if (activePanel() === this) return;
    activePanel.set(this);
    this.opened.emit();
  }

  private close(): void {
    if (activePanel() === this) activePanel.set(null);
  }

  /** 點面板與觸發連結以外的地方就收合 */
  @HostListener('document:pointerdown', ['$event'])
  protected onPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  /** 滑鼠離開「連結＋面板」的範圍超過 CLOSE_DISTANCE_PX 才收合 */
  @HostListener('document:mousemove', ['$event'])
  protected onMouseMove(event: MouseEvent): void {
    if (!this.open()) return;
    const rects = [this.trigger()?.nativeElement, this.panel()?.nativeElement]
      .filter((el): el is HTMLElement => !!el)
      .map((el) => el.getBoundingClientRect());
    if (rects.length === 0) return;
    const left = Math.min(...rects.map((r) => r.left)) - CLOSE_DISTANCE_PX;
    const right = Math.max(...rects.map((r) => r.right)) + CLOSE_DISTANCE_PX;
    const top = Math.min(...rects.map((r) => r.top)) - CLOSE_DISTANCE_PX;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + CLOSE_DISTANCE_PX;
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) this.close();
  }
}
