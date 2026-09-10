import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Economy } from './economy';

describe('Economy', () => {
  let component: Economy;
  let fixture: ComponentFixture<Economy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Economy]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Economy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
