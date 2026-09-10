export interface CatalogModel {

  // 內層：單一文物物件
  id: string;                  // UUID 格式字串，非 number
  artifactRef: string;         // 文物編號，如 "故玉009113N000000000"
  name: string;                // 文物名稱
  categoryCode: string;        // 分類代碼，如 "JADE"
  categoryName: string;        // 分類中文名稱，如 "玉器"
  eraCode: string;             // 朝代代碼，如 "QING"
  eraName: string;             // 朝代中文名稱，如 "清"
  thumbnailPath: string;       // 縮圖相對路徑
  hasQuestionEntry: boolean;   // 是否有問答條目
  hasShopProduct: boolean;     // 是否有對應商店商品
}

// 外層：分頁回應包裝
export interface CatalogListResponse {
  items: CatalogModel[];      // 陣列型別，元素為 Artifact
  page: number;           // 目前頁碼
  pageSize: number;       // 每頁筆數
  totalCount: number;     // 總筆數
  totalPages: number;     // 總頁數
}

