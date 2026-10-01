import { Directive, ElementRef, effect, inject, input, output } from '@angular/core';

/**
 * 商城對話框共用的原生 `<dialog>` 行為，用在 `<dialog [appModalDialog]="open()" (dismiss)="…">`：
 * - 依 `open` 狀態以 modal 模式開關對話框，焦點鎖定由瀏覽器處理。
 * - Esc 會觸發原生 cancel 事件；阻止瀏覽器自行關閉，改發出 `dismiss` 讓頁面更新 open 狀態，
 *   避免兩邊狀態不同步。
 * - 點擊對話框外的背景（事件目標是 dialog 本身）也發出 `dismiss`。
 * 「dismiss」代表使用者想離開對話框，實際代表取消或確認由各對話框決定。
 */
@Directive({
  selector: 'dialog[appModalDialog]',
  host: {
    '(cancel)': 'onNativeCancel($event)',
    '(click)': 'onClick($event)',
  },
})
export class ModalDialog {
  /** 是否顯示對話框 */
  readonly open = input.required<boolean>({ alias: 'appModalDialog' });
  /** 使用者按 Esc 或點擊背景，想離開對話框 */
  readonly dismiss = output<void>();

  private readonly element = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const open = this.open();
      if (open && !this.element.open) this.element.showModal();
      else if (!open && this.element.open) this.element.close();
    });
  }

  protected onNativeCancel(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }

  protected onClick(event: MouseEvent): void {
    if (event.target === this.element) this.dismiss.emit();
  }
}
