import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartLine } from './cart-line';

describe('CartLine', () => {
  let component: CartLine;
  let fixture: ComponentFixture<CartLine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartLine]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartLine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
