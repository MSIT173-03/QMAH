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

/**
 * 對應「單一文物詳細資料」API：GET /catalog/artifacts/{id}
 *
 * 清單 API（GET /catalog/artifacts）只回傳 CatalogModel 的欄位；
 * 要看到 description / sizeText / primaryImagePath / 授權資訊等鑑賞細節，
 * 必須先從清單拿到 id，再用 id 打這支 API 才拿得到。
 */
export interface CatalogDetailModel extends CatalogModel {
  eraTextOriginal: string;        // 朝代原始文字，如 "清 乾隆"
  creatorDisplay: string | null;  // 作者／製作者顯示名稱，可能為 null（無明確作者）
  description: string;            // 文物說明文字
  sizeText: string;               // 尺寸描述文字，如 "長 5.8 公分、寬 4.5 公分"
  primaryImagePath: string;       // 主要展示圖路徑（非縮圖）
  sourceUrl: string;              // 來源連結（如故宮典藏頁面）
  licenseCode: string;            // 授權代碼，如 "CC-BY-4.0"
  attributionText: string;        // 完整署名文字
}


/** 分類對照資料，對應 /api/v1/catalog/categories */
export interface CategoryModel {
  id: string;
  code: string;
  name: string;
}

/** 年代對照資料，對應 /api/v1/catalog/eras */
export interface EraModel {
  id: string;
  code: string;
  name: string;
  startYear: number; // 西元年，西元前是負數（例如周朝 -1046）
  endYear: number;
}
