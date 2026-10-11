import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { MeApiService } from '../../../core/services/me-api';
import { BackToMember } from '../../../shared/back-to-member/back-to-member';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';

@Component({
  selector: 'app-security',
  imports: [ReactiveFormsModule, RouterLink, BackToMember, QmahIconComponent],
  templateUrl: './security.html',
  styleUrl: './security.scss'
})
export class Security implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly meApi = inject(MeApiService);
  private readonly base = `${environment.apiBaseUrl}/account`;
  readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(100)]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100),
      Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\s\S]+$/)]],
    confirmPassword: ['', Validators.required]
  }, { validators: (form: AbstractControl) => form.get('newPassword')?.value === form.get('confirmPassword')?.value
    ? null : { passwordMismatch: true } });
  loading = true;
  saving = false;
  hasPassword: boolean | null = null;
  changed = false;
  showCurrentPassword = false;
  showPassword = false;
  showConfirmPassword = false;
  errorMessage = '';

  get passwordValue(): string { return this.form.controls.newPassword.value; }
  get passwordValid(): boolean { return this.form.controls.newPassword.valid; }
  get passwordsMatch(): boolean {
    return this.form.controls.confirmPassword.value.length > 0
      && this.form.controls.confirmPassword.value === this.passwordValue;
  }
  get passwordRules() {
    return [
      { label: '至少 8 個字元', valid: this.passwordValue.length >= 8 },
      { label: '至少 1 個大寫英文', valid: /[A-Z]/.test(this.passwordValue) },
      { label: '至少 1 個小寫英文', valid: /[a-z]/.test(this.passwordValue) },
      { label: '至少 1 個數字', valid: /\d/.test(this.passwordValue) },
      { label: '至少 1 個特殊符號', valid: /[^A-Za-z0-9]/.test(this.passwordValue) }
    ];
  }

  ngOnInit(): void { this.loadStatus(); }

  loadStatus(): void {
    if (!this.loading && this.hasPassword !== null) return;
    this.loading = true;
    this.errorMessage = '';
    this.http.get<{ hasPassword: boolean }>(`${this.base}/password-status`).pipe(
      finalize(() => { this.loading = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: data => this.hasPassword = data.hasPassword,
      error: (error: HttpErrorResponse) => this.errorMessage = error.status === 401
        ? '登入狀態已失效，請重新登入。' : '無法讀取帳號安全設定，請稍後重試。'
    });
  }

  submit(): void {
    if (this.saving || this.loading || this.changed || this.hasPassword !== true) return;
    this.errorMessage = '';
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const request = this.form.getRawValue();
    if (request.newPassword === request.currentPassword) {
      this.errorMessage = '新密碼不可與目前密碼相同。';
      return;
    }
    this.saving = true;
    this.http.get(`${this.base}/antiforgery-token`).pipe(
      switchMap(() => this.http.post(`${this.base}/change-password`, request)),
      finalize(() => { this.saving = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: () => {
        this.form.reset();
        this.changed = true;
        this.showCurrentPassword = this.showPassword = this.showConfirmPassword = false;
        this.auth.clearSession();
        this.meApi.clear();
      },
      error: (error: HttpErrorResponse) => {
        const validation = error.error?.errors as Record<string, string[]> | undefined;
        this.errorMessage = error.status === 401 ? '登入狀態已失效，請重新登入。'
          : error.status === 429 ? '操作太頻繁，請稍後再試。'
          : error.status === 423 ? '帳號暫時鎖定，請稍後再試或使用忘記密碼。'
          : error.status === 409 ? '此帳號尚未設定密碼，請使用忘記密碼寄送重設連結。'
          : error.status === 400 ? (validation ? Object.values(validation).flat().join(' ') : error.error?.detail)
            || '目前密碼不正確或新密碼不符合規則。'
          : '密碼修改失敗，請稍後再試。';
      }
    });
  }
}
