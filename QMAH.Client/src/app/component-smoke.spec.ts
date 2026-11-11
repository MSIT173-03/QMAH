import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Achievements } from './features/user/achievements/achievements';
import { Addresses } from './features/user/addresses/addresses';
import { SiteFooter } from './shared/components/site-footer/site-footer';
import { Breadcrumb } from './store/component/breadcrumb/breadcrumb';
import { EmptyState } from './store/component/empty-state/empty-state';
import { PageTitleRow } from './store/component/page-title-row/page-title-row';
import { Panel } from './store/component/panel/panel';
import { PillGroup } from './store/component/pill-group/pill-group';
import { QtyStepper } from './store/component/qty-stepper/qty-stepper';
import { SectionHead } from './store/component/section-head/section-head';
import { CartAddons } from './store/pages/cart/cart-addons/cart-addons';
import { CartLine } from './store/pages/cart/cart-line/cart-line';
import { CartSummary } from './store/pages/cart/cart-summary/cart-summary';
import { CatalogService } from './services/catalog-service';
import { KeyService } from './services/key-service';

const components: [string, Type<unknown>, boolean][] = [
  ['ForgotPassword', ForgotPassword, true],
  ['ResetPassword', ResetPassword, true],
  ['Achievements', Achievements, true],
  ['Addresses', Addresses, true],
  ['SiteFooter', SiteFooter, true],
  ['Breadcrumb', Breadcrumb, false],
  ['EmptyState', EmptyState, false],
  ['PageTitleRow', PageTitleRow, false],
  ['Panel', Panel, false],
  ['PillGroup', PillGroup, false],
  ['QtyStepper', QtyStepper, false],
  ['SectionHead', SectionHead, false],
  ['CartAddons', CartAddons, false],
  ['CartLine', CartLine, false],
  ['CartSummary', CartSummary, false],
];

describe('Component initialization smoke checks', () => {
  it.each(components)('%s can initialize with its required providers', async (_name, component, needsRouter) => {
    await TestBed.configureTestingModule({
      imports: [component],
      providers: needsRouter ? [provideRouter([])] : [],
    }).compileComponents();
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('Local service initialization smoke checks', () => {
  const services: [string, Type<unknown>][] = [['CatalogService', CatalogService], ['KeyService', KeyService]];
  it.each(services)('%s can initialize', (_name, service) => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(service)).toBeTruthy();
  });
});
