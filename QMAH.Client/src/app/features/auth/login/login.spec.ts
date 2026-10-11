import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme';
import { environment } from '../../../../environments/environment';

describe('第三方登入衝突提示', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const providerError of ['googleError', 'logtoError']) {
    it(`${providerError} 要求使用原登入方式，不會自動提交登入`, () => {
      const passwordLogin = vi.fn();
      const navigateByUrl = vi.fn();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      TestBed.configureTestingModule({
        providers: [Login, FormBuilder, provideHttpClient(), provideHttpClientTesting(),
          { provide: AuthService, useValue: { getCapabilities: () => of({ googleLoginEnabled: true }), passwordLogin } },
          { provide: Router, useValue: { navigateByUrl } },
          { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ [providerError]: 'account_link_required' }) } } },
          { provide: ThemeService, useValue: { theme: signal('qmah') } }]
      });
      const login = TestBed.inject(Login);
      login.ngOnInit();
      expect(login.errorMessage).toContain('尚未綁定');
      expect(login.errorMessage).toContain('請使用原本的登入方式');
      expect(login.form.getRawValue().email).toBe('');
      expect(passwordLogin).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      const http = TestBed.inject(HttpTestingController);
      if (!environment.production) http.expectOne('/demo/demo-accounts.json').flush([]);
      http.verify();
      login.ngOnDestroy();
    });
  }
});
