import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DevLoginComponent } from './dev-login';

describe('DevLoginComponent', () => {
  let component: DevLoginComponent;
  let fixture: ComponentFixture<DevLoginComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevLoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(DevLoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('is hidden in production builds', () => {
    component.isProduction = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.card')).toBeNull();
  });

  it('fetches an antiforgery token before logging in', () => {
    component.password = 'demo-password';
    component.login();

    // Login 也套用 [AutoValidateAntiforgeryToken]，一定要先拿 token 才能送出登入請求
    const tokenReq = httpMock.expectOne((r) => r.url.endsWith('/account/antiforgery-token'));
    expect(tokenReq.request.method).toBe('GET');
    tokenReq.flush(null);

    const loginReq = httpMock.expectOne((r) => r.url.endsWith('/account/login'));
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush(null);

    // 登入成功後會順便呼叫 MeApiService.refresh() 讓 NavBar 同步顯示目前帳號
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'admin@qmah.local',
      displayName: null,
      status: 'ACTIVE',
      pointBalance: 0,
      roles: ['Admin'],
      createdAt: '2026-01-01T00:00:00Z',
      bio: null,
      visibility: 'PRIVATE',
      avatarPath: null
    });

    expect(component.message).toContain('已登入');
    expect(component.pending).toBe(false);
  });

  it('shows a friendly message on failed login', () => {
    component.password = 'wrong';
    component.login();

    httpMock.expectOne((r) => r.url.endsWith('/account/antiforgery-token')).flush(null);

    const loginReq = httpMock.expectOne((r) => r.url.endsWith('/account/login'));
    loginReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.message).toBe('登入失敗：帳號或密碼錯誤。');
    expect(component.pending).toBe(false);
  });
});
