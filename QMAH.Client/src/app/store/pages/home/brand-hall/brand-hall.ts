import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Panel } from '../../../component/panel/panel';
import { SectionHead } from '../../../component/section-head/section-head';
import { HomeApi } from '../../../api/home.api';

/** 首頁「品牌館」面板：品牌卡片格狀排列 */
@Component({
  selector: 'app-brand-hall',
  imports: [Panel, SectionHead],
  templateUrl: './brand-hall.html',
  styleUrls: [
    './brand-hall.scss',
  ],
})
export class BrandHall {
  /** 品牌清單 */
  protected readonly brands = toSignal(inject(HomeApi).getBrands(), { initialValue: [] });
}
