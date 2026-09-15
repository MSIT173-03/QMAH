export interface CatalogModel {
  // 內層：單一文物物件（對應清單 API GET /catalog/artifacts 的每一筆）
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

/**
 * 對應「單一文物詳細資料」API：GET /catalog/artifacts/{id}
 *
 * 清單 API（GET /catalog/artifacts）只回傳 CatalogModel 的欄位；
 * 要看到 description / sizeText / primaryImagePath / 授權資訊等鑑賞細節，
 * 必須先從清單拿到 id，再用 id 打這支 API 才拿得到。
 * 所以獨立成另一個 interface，而不是塞進 CatalogModel——
 * 清單一次回傳 20 筆，本來就不會也不需要帶這些較重的欄位。
 */
export interface CatalogDetailModel extends CatalogModel {
  eraTextOriginal: string;        // 朝代原始文字，如 "清 乾隆"
  creatorDisplay: string | null;  // 作者／製作者顯示名稱，可能為 null（無明確作者）
  description: string;            // 文物說明文字
  sizeText: string;               // 尺寸描述文字，如 "長 5.8 公分、寬 4.5 公分"
  primaryImagePath: string;       // 主要展示圖路徑（非縮圖）
  sourceUrl: string;               // 來源連結（如故宮典藏頁面）
  licenseCode: string;             // 授權代碼，如 "CC-BY-4.0"
  attributionText: string;         // 完整署名文字
}

// 外層：分頁回應包裝（清單 API 專用，元素固定是 CatalogModel，不是 CatalogDetailModel）
export interface CatalogListResponse {
  items: CatalogModel[];      // 陣列型別，元素為 Artifact
  page: number;           // 目前頁碼
  pageSize: number;       // 每頁筆數
  totalCount: number;     // 總筆數
  totalPages: number;     // 總頁數
}
