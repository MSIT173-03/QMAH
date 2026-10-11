import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule, RouterLink, QmahIconComponent],
  templateUrl: './verify-email.html',
  styleUrls: ['../forgot-password/forgot-password.scss', './verify-email.scss']
})
export class VerifyEmail {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly base = `${environment.apiBaseUrl}/account`;
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly linkedEmail = this.route.snapshot.queryParamMap.get('email') ?? '';
  readonly hasLink = !!this.token && !!this.linkedEmail;
  readonly form = inject(FormBuilder).nonNullable.group({
    email: [this.linkedEmail, [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', this.hasLink ? [] : [Validators.required, Validators.maxLength(100)]]
  });
  busy = false;
  verified = false;
  successMessage = this.route.snapshot.queryParamMap.get('delivery') === 'sent'
    ? '帳號已建立，驗證信已寄出。請查看收件匣或垃圾郵件，開啟信中的連結完成驗證。' : '';
  errorMessage = this.route.snapshot.queryParamMap.get('delivery') === 'failed'
    ? '帳號已建立，但驗證信暫時寄送失敗。請稍後使用下方按鈕重寄，無須重新註冊。' : '';

  confirm(): void {
    if (this.busy || this.verified || !this.hasLink) return;
    this.send('confirm-email', { email: this.linkedEmail, token: this.token }, () => {
      this.verified = true;
      this.successMessage = '信箱驗證完成！現在可以使用電子郵件與密碼登入。';
    });
  }

  resend(): void {
    if (this.busy || this.verified) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    // 從註冊結果或驗證信進入時，重寄與確認使用同一信箱，不採用表單中的替代值。
    const email = (this.linkedEmail || this.form.controls.email.value).trim();
    const endpoint = this.hasLink ? 'resend-confirmation-link' : 'resend-confirmation';
    const body = this.hasLink ? { email, token: this.token } : { email, password: this.form.controls.password.value };
    this.send(endpoint, body, () => {
      this.successMessage = this.hasLink
        ? '若此信箱尚未驗證，驗證信將寄到該信箱。請查看收件匣與垃圾郵件。'
        : '若帳號密碼正確、帳號可用且信箱尚未驗證，驗證信將寄到該信箱。請查看收件匣與垃圾郵件。';
    });
  }

  private send(endpoint: string, body: object, onSuccess: () => void): void {
    this.busy = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.http.get(`${this.base}/antiforgery-token`).pipe(
      switchMap(() => this.http.post(`${this.base}/${endpoint}`, body)),
      finalize(() => { this.busy = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: onSuccess,
      error: (error: HttpErrorResponse) => {
        this.errorMessage = error.status === 400
          ? this.hasLink ? '驗證連結無效或已過期，請使用下方「重新申請驗證信」。' : '請確認 Email 與密碼格式後再試。'
          : error.status === 429 ? '操作太頻繁，請稍後再試。'
          : '目前無法完成操作，請稍後再試。';
      }
    });
  }
}
