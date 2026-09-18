import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProductList } from './product-list';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('ProductList', () => {
  let component: ProductList;
  let fixture: ComponentFixture<ProductList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      // ProductList 內含 routerLink 與分頁切換時更新網址查詢字串，兩者皆需要 Router／ActivatedRoute。
      providers: [provideRouter([]), provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
