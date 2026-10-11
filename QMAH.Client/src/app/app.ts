import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationDialogComponent } from './shared/components/confirmation-dialog/confirmation-dialog';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container';
import { ConfirmationService } from './core/services/confirmation';
import { ToastService } from './core/services/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmationDialogComponent, ToastContainerComponent],
  templateUrl: './app.html'
})
export class App { readonly confirmation = inject(ConfirmationService); readonly toast = inject(ToastService); }
