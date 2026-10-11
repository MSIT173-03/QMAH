import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';

export interface ConfirmationRequest { title: string; message: string; confirmLabel: string; danger?: boolean; }

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  readonly current = signal<ConfirmationRequest | null>(null);
  private resolve?: (confirmed: boolean) => void;
  constructor() {
    inject(Router, { optional: true })?.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {
      if (event instanceof NavigationStart) this.complete(false);
    });
  }
  ask(request: ConfirmationRequest): Promise<boolean> {
    if (this.current()) return Promise.resolve(false);
    this.current.set(request);
    return new Promise(resolve => { this.resolve = resolve; });
  }
  complete(confirmed: boolean): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.current.set(null);
    resolve?.(confirmed);
  }
}
