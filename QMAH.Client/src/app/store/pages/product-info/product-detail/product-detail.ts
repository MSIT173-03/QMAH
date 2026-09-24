import { Component, computed, input } from '@angular/core';
import { SectionHead } from '../../../component';
import { ProductPolicy } from '../../../api/api.models';

/** 商品頁「商品說明」區塊：原文物說明與保養／退換／鑑定條列。 */
@Component({
  selector: 'app-product-detail',
  imports: [SectionHead],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  /** 產生器提供的套組說明；保留段落與條列換行。 */
  intro = input('');
  /** 商品政策條列（全站共通的保養、退換、鑑定說明） */
  rows = input<ProductPolicy[]>([]);

  /** 以下為區塊的固定版面文字。 */
  protected readonly title = '商品說明';
  protected readonly tag = 'DETAILS';
  /** 只把資料中的段落標題加粗，內文仍使用純文字，避免把資料當 HTML 執行。 */
  protected readonly descriptionBlocks = computed(() =>
    this.intro().trim().split(/\n\s*\n/u).filter(Boolean).map((block) => {
      const lines = block.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
      const heading = /^(套組內容|文物資料|商品用途|來源與姓名標示|原文物說明|商品資訊)：$/u.test(lines[0] ?? '')
        ? lines[0]
        : '';
      return { heading, lines: heading ? lines.slice(1) : lines };
    }),
  );
}
