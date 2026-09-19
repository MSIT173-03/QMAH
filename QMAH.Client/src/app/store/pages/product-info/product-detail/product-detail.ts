import { Component, input } from '@angular/core';
import { SectionHead } from '../../../component';
import { ProductPolicy } from '../../../api/api.models';

/** 商品頁「商品說明」區塊：說明段落、說明圖與保養／退換／鑑定條列 */
@Component({
  selector: 'app-product-detail',
  imports: [SectionHead],
  templateUrl: './product-detail.html',
  styleUrls: [
    './product-detail.scss',
  ],
})
export class ProductDetail {
  /** 商品說明段落 */
  intro = input('');
  /** 商品政策條列（全站共通的保養、退換、鑑定說明） */
  rows = input<ProductPolicy[]>([]);

  /** 以下為區塊的固定版面文字 */
  protected readonly title = '商品說明';
  protected readonly tag = 'DETAILS';
  /** 說明圖尚無實際圖片，先以佔位文字呈現版位 */
  protected readonly imageSlot = '[ 商品說明圖 · 情境／細節 1600×900 ]';
}
