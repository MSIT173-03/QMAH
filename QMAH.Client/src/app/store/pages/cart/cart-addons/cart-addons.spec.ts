import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartAddons } from './cart-addons';

describe('CartAddons', () => {
  let component: CartAddons;
  let fixture: ComponentFixture<CartAddons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartAddons]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartAddons);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
