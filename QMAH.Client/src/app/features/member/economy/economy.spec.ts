import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Economy } from './economy';

describe('Economy', () => {
  let component: Economy;
  let fixture: ComponentFixture<Economy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Economy],
      // integration: 元件使用 RouterLink／ActivatedRoute；測試補最小 router provider，不改正式路由行為。
      providers: [provideRouter([])]
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
