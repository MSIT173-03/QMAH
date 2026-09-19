import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckoutPage } from './checkout';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('CheckoutPage', () => {
  let component: CheckoutPage;
  let fixture: ComponentFixture<CheckoutPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckoutPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
