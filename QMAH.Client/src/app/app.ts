import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationDialogComponent } from './shared/components/confirmation-dialog/confirmation-dialog';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container';
import { ConfirmationService } from './core/services/confirmation';
import { ToastService } from './core/services/toast';
import { PageReadiness } from './core/services/page-readiness';
import { PageLoaderComponent } from './shared/components/page-loader/page-loader';
import { MobilePageTools } from './shared/components/mobile-page-tools/mobile-page-tools';
import { isPhoneViewport } from './shared/styles/responsive-breakpoints';

@Component({
  selector: 'app-root',
  imports: [MobilePageTools, RouterOutlet, ConfirmationDialogComponent, ToastContainerComponent, PageLoaderComponent],
  templateUrl: './app.html'
})
export class App {
  readonly confirmation = inject(ConfirmationService);
  readonly toast = inject(ToastService);
  readonly pageReady = inject(PageReadiness);
  readonly phoneViewport = signal(isPhoneViewport(typeof window === 'undefined' ? null : window));

  @HostListener('window:resize')
  onResize(): void { this.phoneViewport.set(isPhoneViewport(window)); }
}
