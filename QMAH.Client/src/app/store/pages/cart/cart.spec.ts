import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cart } from './cart';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('Cart', () => {
  let component: Cart;
  let fixture: ComponentFixture<Cart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cart],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
