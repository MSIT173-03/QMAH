import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      // Home 內含 routerLink（新品上架／分類導覽），RouterLink 指令需要 ActivatedRoute，
      // 故補上最小可用的路由設定，供測試環境注入。
      providers: [provideRouter([]), provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    // 首頁子元件包含輪播與倒數的持續性 interval；建立測試夾具不需等待它們「穩定」，
    // 否則測試會永遠等不到穩定狀態而逾時，且不影響本測試要驗證的元件建立契約。
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
