import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QtyStepper } from './qty-stepper';

describe('QtyStepper', () => {
  let component: QtyStepper;
  let fixture: ComponentFixture<QtyStepper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QtyStepper]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QtyStepper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
