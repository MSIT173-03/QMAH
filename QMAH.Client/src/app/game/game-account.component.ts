import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';

import { GameNavigationComponent } from './game-navigation.component';
import { GameService } from './game.service';
import { GameAccountService } from './game-account.service';

@Component({
  selector: 'app-game-account',
  imports: [FormsModule, RouterLink, GameNavigationComponent],
  templateUrl: './game-account.component.html',
  styleUrl: './game-account.component.scss'
})
export class GameAccountComponent implements OnInit, OnDestroy {
  readonly accountService = inject(GameAccountService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private sessionSubscription?: Subscription;

  email = '';
  password = '';
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

  login(): void {
    if (this.busy || !this.email.trim() || !this.password) return;
    this.busy = true;
    this.error = '';
    this.accountService.login(this.email, this.password).pipe(
      finalize(() => {
        this.busy = false;
        this.changeDetector.markForCheck();
      })
    ).subscribe({
      next: () => void this.router.navigate(['/game']),
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
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
        this.password = '';
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.error = this.game.errorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }
}
