import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartPage } from './cart';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('CartPage', () => {
  let component: CartPage;
  let fixture: ComponentFixture<CartPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
