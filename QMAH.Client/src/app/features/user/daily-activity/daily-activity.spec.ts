import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DailyActivity } from './daily-activity';

describe('DailyActivity', () => {
  let component: DailyActivity;
  let fixture: ComponentFixture<DailyActivity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyActivity],
      // integration: 元件使用 RouterLink／ActivatedRoute；測試補最小 router provider，不改正式路由行為。
      providers: [provideRouter([])]
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
