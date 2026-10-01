import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalDialog } from './modal-dialog';

@Component({
  imports: [ModalDialog],
  template: `
    <dialog [appModalDialog]="open()" (dismiss)="dismissed = dismissed + 1">
      <button type="button" class="inner">內容</button>
    </dialog>
  `,
})
class Host {
  readonly open = signal(false);
  dismissed = 0;
}

describe('ModalDialog', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let dialog: HTMLDialogElement;

  beforeEach(async () => {
    // jsdom 尚未實作原生 <dialog> 的 showModal／close；補上最小行為（切換 open 屬性）。
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };

    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    dialog = fixture.nativeElement.querySelector('dialog');
  });

  const setOpen = async (open: boolean): Promise<void> => {
    host.open.set(open);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('opens and closes the native dialog following the bound state', async () => {
    expect(dialog.open).toBe(false);

    await setOpen(true);
    expect(dialog.open).toBe(true);

    await setOpen(false);
    expect(dialog.open).toBe(false);
  });

  it('emits dismiss on Esc and keeps the browser from closing the dialog itself', async () => {
    await setOpen(true);

    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(host.dismissed).toBe(1);
    // 是否關閉由使用者綁定的狀態決定，指令本身不自行關閉。
    expect(dialog.open).toBe(true);
  });

  it('emits dismiss when the backdrop (the dialog itself) is clicked, but not for clicks inside', async () => {
    await setOpen(true);

    dialog.querySelector<HTMLElement>('.inner')!.click();
    expect(host.dismissed).toBe(0);

    dialog.click();
    expect(host.dismissed).toBe(1);
  });
});
