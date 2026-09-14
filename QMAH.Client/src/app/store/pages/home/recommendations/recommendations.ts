import { Component, input, output } from '@angular/core'
import { SectionHead } from '../../../component/section-head/section-head'
import { ProductCard } from '../../../component/product-card/product-card'
import { ProductCardData } from '../home.data'

/** 首頁「為你推薦」區塊：個人化商品清單，附載入更多按鈕 */
@Component({
  selector: 'app-recommendations',
  imports: [SectionHead, ProductCard],
  templateUrl: './recommendations.html',
  styleUrls: [
    './recommendations.scss',
  ],
})
export class Recommendations {
  /** 推薦商品清單，由首頁向 API 逐頁載入並累加 */
  items = input<ProductCardData[]>([])
  /** 點擊任一商品卡片的加入購物車按鈕時觸發，帶出商品 ID */
  onAddToCart = output<string>()
  /** 點擊「載入更多」按鈕時觸發 */
  onRequireMore = output<void>()
}
