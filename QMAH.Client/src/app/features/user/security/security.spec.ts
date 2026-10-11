import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Security } from './security';
import { AuthService } from '../../../core/auth/auth.service';
import { MeApiService } from '../../../core/services/me-api';
import { environment } from '../../../../environments/environment';

describe('會員修改密碼', () => {
  const base = `${environment.apiBaseUrl}/account`;
  let http: HttpTestingController;
  const clearSession = vi.fn();
  const clear = vi.fn();

  function setup(hasPassword = true) {
    clearSession.mockClear(); clear.mockClear();
    TestBed.configureTestingModule({
      imports: [Security],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AuthService, useValue: { clearSession } }, { provide: MeApiService, useValue: { clear } }]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Security);
    fixture.detectChanges();
    http.expectOne(`${base}/password-status`).flush({ hasPassword });
    fixture.detectChanges();
    return fixture;
  }
  afterEach(() => http.verify());

  it('第三方專用帳號不顯示目前密碼表單，提供寄信設定入口', () => {
    const fixture = setup(false);
    expect(fixture.nativeElement.querySelector('#current-password')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('不需要輸入 Google');
    expect(fixture.nativeElement.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    fixture.componentInstance.submit();
    http.expectNone(`${base}/antiforgery-token`);
  });

  it('不一致或強度不足的密碼不能提交', () => {
    const fixture = setup();
    fixture.componentInstance.form.setValue({ currentPassword: 'Original1!', newPassword: 'weak', confirmPassword: 'weak' });
    fixture.componentInstance.submit();
    fixture.componentInstance.form.setValue({ currentPassword: 'Original1!', newPassword: 'Changed2!', confirmPassword: 'Different3!' });
    fixture.componentInstance.submit();
    http.expectNone(`${base}/antiforgery-token`);
    expect(fixture.componentInstance.form.hasError('passwordMismatch')).toBe(true);
  });

  it('保留密碼原始空白，先取得防偽 token；成功後清空表單與兩份登入狀態', () => {
    const fixture = setup();
    const body = { currentPassword: ' Original1! ', newPassword: ' Changed2! ', confirmPassword: ' Changed2! ' };
    fixture.componentInstance.form.setValue(body);
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    const request = http.expectOne(`${base}/change-password`);
    expect(request.request.body).toEqual(body);
    request.flush(null);
    fixture.detectChanges();
    expect(clearSession).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.form.controls.currentPassword.value).toBe('');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('請使用新密碼重新登入');
  });

  it('目前密碼錯誤不清除登入狀態，可修正後重試', () => {
    const fixture = setup();
    fixture.componentInstance.form.setValue({ currentPassword: 'Wrong1!', newPassword: 'Changed2!', confirmPassword: 'Changed2!' });
    fixture.componentInstance.submit();
    http.expectOne(`${base}/antiforgery-token`).flush(null);
    http.expectOne(`${base}/change-password`).flush({ detail: '目前密碼不正確。' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.errorMessage).toBe('目前密碼不正確。');
    expect(fixture.componentInstance.saving).toBe(false);
    expect(clearSession).not.toHaveBeenCalled();
    expect(fixture.componentInstance.changed).toBe(false);
  });
});
