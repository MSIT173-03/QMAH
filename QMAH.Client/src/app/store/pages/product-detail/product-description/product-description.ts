import { Component, input } from '@angular/core';
import { SectionHead } from '../../../component';
import { ProductPolicy } from '../../../api/api.models';

/** 商品頁「商品說明」區塊：說明段落、說明圖與保養／退換／鑑定條列 */
@Component({
  selector: 'app-product-description',
  imports: [SectionHead],
  templateUrl: './product-description.html',
  styleUrls: [
    './product-description.scss',
  ],
})
export class ProductDescription {
  /** 商品說明段落 */
  intro = input('');
  /** 商品說明圖網址，未提供時不顯示說明圖 */
  image = input<string | null>(null);
  /** 商品政策條列（全站共通的保養、退換、鑑定說明） */
  rows = input<ProductPolicy[]>([]);

  /** 以下為區塊的固定版面文字 */
  protected readonly title = '商品說明';
  protected readonly tag = 'DETAILS';
}
