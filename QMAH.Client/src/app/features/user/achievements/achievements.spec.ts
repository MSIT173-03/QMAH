import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Achievements } from './achievements';

describe('Achievements', () => {
  let component: Achievements;
  let fixture: ComponentFixture<Achievements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Achievements],
      // integration: 元件使用 RouterLink／ActivatedRoute；測試補最小 router provider，不改正式路由行為。
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Achievements);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
