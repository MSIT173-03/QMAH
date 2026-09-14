import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductInfo } from './product-info';
import { provideMockApi } from '../../api/mock/mock-api.interceptor';

describe('ProductInfo', () => {
  let component: ProductInfo;
  let fixture: ComponentFixture<ProductInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductInfo],
      providers: [provideMockApi()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductInfo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
