import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Promobar } from './promobar';

describe('Promobar', () => {
  let component: Promobar;
  let fixture: ComponentFixture<Promobar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Promobar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Promobar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
