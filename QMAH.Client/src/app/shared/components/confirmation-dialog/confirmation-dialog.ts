import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmationService } from '../../../core/services/confirmation';
import { ModalDialog } from '../../../store/shared/modal-dialog';
import { LucideInfo, LucideTrash2 } from '@lucide/angular';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [ModalDialog, LucideInfo, LucideTrash2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog class="qmah-confirm" [appModalDialog]="!!state.current()" aria-labelledby="qmah-confirm-title" aria-describedby="qmah-confirm-copy" (dismiss)="state.complete(false)">
    @if (state.current(); as request) {
      <div class="qmah-confirm__mark">@if (request.danger) { <svg lucideTrash2 aria-hidden="true"></svg> } @else { <svg lucideInfo aria-hidden="true"></svg> }</div>
      <h2 id="qmah-confirm-title">{{ request.title }}</h2><p id="qmah-confirm-copy">{{ request.message }}</p>
      <div class="qmah-confirm__actions"><button type="button" class="secondary" autofocus (click)="state.complete(false)">取消</button><button type="button" [class.danger]="request.danger" (click)="state.complete(true)">{{ request.confirmLabel }}</button></div>
    }
  </dialog>`,
  styles: `
    .qmah-confirm{width:min(440px,calc(100vw - 40px));padding:30px;border:0;border-radius:var(--qmah-radius-panel,16px);background:var(--qmah-surface);color:var(--qmah-ink);box-shadow:var(--qmah-shadow-dialog)}.qmah-confirm::backdrop{background:rgb(18 26 25 / 46%)}.qmah-confirm__mark{color:var(--qmah-danger);margin-bottom:14px}h2{margin:0 0 12px;font:600 24px/1.5 var(--qmah-font-serif)}p{margin:0;color:var(--qmah-muted);font:400 16px/1.8 var(--qmah-font-sans)}.qmah-confirm__actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:12px;margin-top:26px}button{min-height:44px;padding:10px 20px;border:1px solid transparent;border-radius:var(--qmah-radius-control,8px);background:var(--qmah-primary);color:var(--qmah-primary-content);font:600 15px/1.5 var(--qmah-font-sans);cursor:pointer}button.secondary{background:transparent;border-color:var(--qmah-border);color:var(--qmah-ink)}button.danger{background:var(--qmah-danger);color:var(--qmah-danger-content)}button:hover{filter:brightness(.94)}button:focus-visible{outline:3px solid var(--qmah-focus);outline-offset:3px}
  `,
})
export class ConfirmationDialogComponent { readonly state = inject(ConfirmationService); }
