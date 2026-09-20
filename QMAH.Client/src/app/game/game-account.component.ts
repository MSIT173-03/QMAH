import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';

import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { GameAccountService } from './game-account.service';

@Component({
  selector: 'app-game-account',
  imports: [RouterLink, GameNavigationComponent],
  templateUrl: './game-account.component.html',
  styleUrl: './game-account.component.scss'
})
export class GameAccountComponent implements OnInit, OnDestroy {
  readonly accountService = inject(GameAccountService);
  private readonly game = inject(GameService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private sessionSubscription?: Subscription;

  loading = true;
  busy = false;
  error = '';

  ngOnInit(): void {
    this.sessionSubscription = this.accountService.loadCurrentAccount().pipe(
      finalize(() => {
        this.loading = false;
        this.changeDetector.markForCheck();
      })
    ).subscribe({
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.sessionSubscription?.unsubscribe();
  }

  logout(): void {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.accountService.logout().pipe(
      finalize(() => {
        this.busy = false;
        this.changeDetector.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }
}
