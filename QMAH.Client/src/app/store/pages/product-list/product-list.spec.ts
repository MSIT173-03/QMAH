import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProductListPage } from './product-list';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('ProductListPage', () => {
  let component: ProductListPage;
  let fixture: ComponentFixture<ProductListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductListPage],
      // ProductListPage 內含 routerLink 與分頁切換時更新網址查詢字串，兩者皆需要 Router／ActivatedRoute。
      providers: [provideRouter([]), provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductListPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
