import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomePage } from './home';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      // HomePage 內含 routerLink（新品上架／分類導覽），RouterLink 指令需要 ActivatedRoute，
      // 故補上最小可用的路由設定，供測試環境注入。
      providers: [provideRouter([]), provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
