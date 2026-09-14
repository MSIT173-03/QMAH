import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Checkout } from './checkout';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('Checkout', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
