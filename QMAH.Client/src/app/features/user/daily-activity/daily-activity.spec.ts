import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyActivity } from './daily-activity';

describe('DailyActivity', () => {
  let component: DailyActivity;
  let fixture: ComponentFixture<DailyActivity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyActivity]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailyActivity);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
