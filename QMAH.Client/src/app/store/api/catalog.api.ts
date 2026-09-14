import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl, getField, toParams } from './http';
import {
  Category,
  Page,
  Product,
  ProductDetail,
  ProductQuery,
  ReviewPage,
  ReviewQuery,
} from './api.models';

/** 商品型錄與詳情 API */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  /** GET /categories：器類清單 */
  getCategories(): Observable<Category[]> {
    return getField(this.http, apiUrl('/categories'), 'categories');
  }

  /** GET /products：商品清單（篩選、排序、分頁） */
  getProducts(query: ProductQuery = {}): Observable<Page<Product>> {
    return this.http.get<Page<Product>>(apiUrl('/products'), { params: toParams(query) });
  }

  /** GET /products/{id}：商品詳情，查無商品時回應 404 */
  getProduct(id: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(apiUrl`/products/${id}`);
  }

  /** GET /products/{id}/related：同類推薦（同器類優先，不足以其他器類補齊） */
  getRelated(id: string, limit?: number): Observable<Product[]> {
    return getField(this.http, apiUrl`/products/${id}/related`, 'items', { limit });
  }

  /** GET /products/{id}/reviews：商品評價（篩選、分頁，附各星等統計） */
  getReviews(id: string, query: ReviewQuery = {}): Observable<ReviewPage> {
    return this.http.get<ReviewPage>(apiUrl`/products/${id}/reviews`, { params: toParams(query) });
  }
}
