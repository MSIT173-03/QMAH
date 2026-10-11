import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { VerifyEmail } from './verify-email';
import { environment } from '../../../../environments/environment';

describe('信箱驗證', () => {
  const base = `${environment.apiBaseUrl}/account`;
  let http: HttpTestingController;

  function setup(params: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } }]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VerifyEmail);
    if (!params['token']) fixture.componentInstance.form.controls.password.setValue('Correct1!');
    return fixture;
  }

  afterEach(() => http.verify());

  it('開啟驗證信不會自動消耗 token，使用者確認後才送出，且防止重複送出', () => {
    const fixture = setup({ email: 'member@example.com', token: 'signed-token' });
    fixture.detectChanges();
    http.expectNone(`${base}/confirm-email`);
    fixture.componentInstance.confirm();
    fixture.componentInstance.confirm();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    const request = http.expectOne(`${base}/confirm-email`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'member@example.com', token: 'signed-token' });
    request.flush(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.verified).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('信箱驗證完成');
    fixture.componentInstance.confirm();
    http.expectNone(`${base}/confirm-email`);
  });

  it('過期連結重寄也須驗證原 token，失效後提供獨立申請入口', () => {
    const fixture = setup({ email: 'member@example.com', token: 'expired' });
    fixture.componentInstance.confirm();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    http.expectOne(`${base}/confirm-email`).flush({}, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.verified).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('過期');
    fixture.componentInstance.resend();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    const request = http.expectOne(`${base}/resend-confirmation-link`);
    expect(request.request.body).toEqual({ email: 'member@example.com', token: 'expired' });
    request.flush({}, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.componentInstance.successMessage).toBe('');
    expect(fixture.nativeElement.querySelector('a[href="/verify-email"]')).not.toBeNull();
  });

  it('驗證信指定的信箱顯示停用文字框，重寄不採用表單被更動後的值', () => {
    const fixture = setup({ email: 'member@example.com', token: 'signed-token' });
    fixture.detectChanges();
    const emailInput = fixture.nativeElement.querySelector('#verification-email') as HTMLInputElement;
    expect(emailInput.disabled).toBe(true);
    expect(emailInput.value).toBe('member@example.com');
    fixture.componentInstance.form.controls.email.setValue('other@example.com');
    fixture.componentInstance.resend();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    const request = http.expectOne(`${base}/resend-confirmation-link`);
    expect(request.request.body).toEqual({ email: 'member@example.com', token: 'signed-token' });
    request.flush({});
  });

  it('寄信失敗保留恢復入口，無效信箱不發送請求', () => {
    const fixture = setup({ delivery: 'failed' });
    expect(fixture.componentInstance.errorMessage).toContain('無須重新註冊');
    fixture.componentInstance.form.controls.email.setValue('invalid');
    fixture.componentInstance.resend();
    http.expectNone(`${base}/antiforgery-token`);
    expect(fixture.componentInstance.form.controls.email.touched).toBe(true);
  });

  it('限流後解鎖按鈕並提示稍後重試', () => {
    const fixture = setup({ email: 'member@example.com' });
    fixture.componentInstance.resend();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    http.expectOne(`${base}/resend-confirmation`).flush({}, { status: 429, statusText: 'Too Many Requests' });
    expect(fixture.componentInstance.busy).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('太頻繁');
  });

  it('沒有原 token 時必須輸入密碼，不能只憑 Email 重寄', () => {
    const fixture = setup({ email: 'member@example.com' });
    fixture.componentInstance.form.controls.password.setValue('');
    fixture.componentInstance.resend();
    http.expectNone(`${base}/antiforgery-token`);
    fixture.componentInstance.form.controls.password.setValue('Correct1!');
    fixture.componentInstance.resend();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    const request = http.expectOne(`${base}/resend-confirmation`);
    expect(request.request.body).toEqual({ email: 'member@example.com', password: 'Correct1!' });
    request.flush({});
  });
});
