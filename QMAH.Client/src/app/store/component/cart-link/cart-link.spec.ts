import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartLink } from './cart-link';

describe('CartLink', () => {
  let component: CartLink;
  let fixture: ComponentFixture<CartLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartLink]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CartLink);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
