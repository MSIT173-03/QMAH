import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { provideRouter } from '@angular/router';

import { SessionBar } from './session-bar';
import { injectCartState } from '../../shared/page-state';

describe('SessionBar', () => {
  let component: SessionBar;
  let fixture: ComponentFixture<SessionBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionBar],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionBar);
    component = fixture.componentInstance;
    fixture.componentRef.setInput(
      'cart',
      runInInjectionContext(TestBed.inject(Injector), () => injectCartState()),
    );
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the promobar and the login prompt', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-promobar')).not.toBeNull();
    expect(element.querySelector('app-login-prompt')).not.toBeNull();
  });
});
