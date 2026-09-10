import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface EconomyKey {
  id: string;
  code: string;
  name: string;
  scopeType: string;
  categoryId: string | null;
  eraBucketId: string | null;
  balance: number;
  eligibleArtifactCount: number;
  recyclePointValue: number;
}

interface EconomyResponse {
  pointBalance: number;
  keyProgressBalance: number;
  keyProgressToNormalKey: number;
  keys: EconomyKey[];
}

@Component({
  selector: 'app-economy',
  imports: [CommonModule],
  templateUrl: './economy.html',
  styleUrl: './economy.scss'
})
export class Economy implements OnInit {

  economy: EconomyResponse | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadEconomy();
  }

  private loadEconomy(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<EconomyResponse>('/api/v1/me/economy')
      .subscribe({
        next: (data) => {
          console.log('economy:', data);

          this.economy = data;
          this.loading = false;

          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('economy error:', error);

          this.errorMessage = '讀取點數與鑰匙資料失敗';
          this.loading = false;

          this.cdr.detectChanges();
        }
      });
  }
}
