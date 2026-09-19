import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetailPage } from './product-detail';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('ProductDetailPage', () => {
  let component: ProductDetailPage;
  let fixture: ComponentFixture<ProductDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailPage],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductDetailPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
