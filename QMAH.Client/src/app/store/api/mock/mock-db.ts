import {
  Brand,
  Coupon,
  HeroSlide,
  HotSearchLink,
  MemberProfile,
  PaymentOption,
  Review,
  ShippingOption,
  SiteConfig,
} from '../api.models';

/**
 * 假 API 的資料來源：原本散落在各 *.data.ts 的佔位資料，集中於此模擬後端資料庫。
 * 購物車內容為可變狀態，同一次瀏覽中跨頁面保留，重新整理頁面即還原。
 */

/* ===============================
   商品型錄
   =============================== */

/** 商品型錄紀錄（模擬後端資料表欄位） */
export interface CatalogRecord {
  id: string;
  name: string;
  brand: string;
  /** 定價（未折扣） */
  price: number;
  /** 折扣比例，0 代表無折扣 */
  off: number;
  /** 器類名稱 */
  cat: string;
  /** 材質與工法說明 */
  material: string;
  /** 紋樣／器型出處說明 */
  source: string;
  /** 尺寸／規格說明 */
  dims: string;
  /** 對應文物原始尺寸；商品本身一律使用固定 A6 明信片尺寸。 */
  artifactDims?: string;
  /** 假 API 也使用正式媒體路徑，避免詳情頁落回無圖佔位面。 */
  image?: string;
  rating: number;
  reviews: number;
  /** 上架日期（YYYY-MM-DD） */
  listedAt: string;
}

const SOURCE_CATALOG: CatalogRecord[] = [
  { id: 'qc-01', name: '青花纏枝紋蓋杯 220ml', brand: '窯作研究', price: 1280, off: 0.25, cat: '陶瓷', material: '景德鎮高白瓷 · 釉下青花', source: '紋樣取自院藏明永樂青花纏枝蓮紋蓋碗', dims: '高 8.2 公分、口徑 10.5 公分、足徑 8.5 公分', rating: 4.8, reviews: 214, listedAt: '2026-03-12' },
  { id: 'qc-02', name: '汝窯天青釉茶盞 對杯', brand: '窯作研究', price: 2480, off: 0, cat: '陶瓷', material: '仿汝天青釉 · 手工修坯', source: '釉色參考北宋汝窯青瓷盞', dims: '高 3.2–1.85 公分、口徑 7.45 公分、足徑 5.4 公分', rating: 4.7, reviews: 96, listedAt: '2026-09-08' },
  { id: 'qc-03', name: '唐三彩馬 桌上擺件', brand: '陶俑工坊', price: 2680, off: 0, cat: '陶瓷', material: '陶胎三彩釉 · 手工上釉', source: '原件為唐代三彩陶馬', dims: '高 24.5 公分、長 22.0 公分、座寬 9.5 公分', rating: 4.8, reviews: 61, listedAt: '2026-02-20' },
  { id: 'qc-04', name: '梅瓶造型細口花器', brand: '窯作研究', price: 2180, off: 0.15, cat: '陶瓷', material: '白瓷 · 半亞光釉', source: '器型取自元明梅瓶', dims: '高 26.0 公分、口徑 2.3 公分、底徑 8.4 公分', rating: 4.7, reviews: 84, listedAt: '2026-04-05' },
  { id: 'qc-05', name: '獸面紋方鼎造型鎮紙', brand: '金石堂號', price: 880, off: 0, cat: '青銅器', material: '黃銅實心 · 做舊處理', source: '紋樣取自商代晚期青銅方鼎', dims: '寬 8.75 公分、高 5.75 公分、重 640 公克', rating: 4.5, reviews: 73, listedAt: '2026-01-15' },
  { id: 'qc-06', name: '青銅紋香道器具五件組', brand: '香道處', price: 3280, off: 0, cat: '青銅器', material: '黃銅 · 胡桃木托盤', source: '器型參考宋代香事器具', dims: '托盤 12.5 × 28.0 公分、爐高 6.8 公分', rating: 4.9, reviews: 47, listedAt: '2026-01-22' },
  { id: 'qc-07', name: '竹雕山水紋筆筒', brand: '刻工小舍', price: 1980, off: 0.15, cat: '雕刻', material: '老竹材 · 手工浮雕', source: '刀法參考明清嘉定竹刻', dims: '高 14.2 公分、口徑 9.6 公分', rating: 4.6, reviews: 58, listedAt: '2026-03-30' },
  { id: 'qc-08', name: '木雕蓮花紋香座', brand: '刻工小舍', price: 1180, off: 0.2, cat: '雕刻', material: '檀香木 · 榫接無膠', source: '紋樣取自唐代蓮花石雕', dims: '直徑 9.8 公分、高 2.75 公分', rating: 4.4, reviews: 91, listedAt: '2026-02-08' },
  { id: 'qc-09', name: '歷代錢幣紋樣', brand: '泉譜工房', price: 1480, off: 0.25, cat: '錢幣', material: '黃銅翻鑄 · 附絨布內襯木盒', source: '錢式涵蓋半兩、五銖至光緒元寶', dims: '單枚口徑 2.3 公分、厚 1.35 公厘', rating: 4.7, reviews: 132, listedAt: '2026-05-14' },
  { id: 'qc-10', name: '開元通寶紋樣黃銅書籤', brand: '泉譜工房', price: 480, off: 0, cat: '錢幣', material: '黃銅蝕刻 · 手工拋光', source: '字體取自唐開元通寶', dims: '1.75 × 7.6 公分', rating: 4.5, reviews: 204, listedAt: '2026-05-20' },
  { id: 'qc-11', name: '掐絲琺瑯纏枝紋香盒', brand: '琺瑯作', price: 3480, off: 0.1, cat: '琺瑯器', material: '銅胎掐絲 · 燒藍琺瑯', source: '紋樣取自清乾隆掐絲琺瑯器', dims: '口徑 7.45 公分、高 4.2 公分', rating: 4.9, reviews: 38, listedAt: '2026-08-30' },
  { id: 'qc-12', name: '畫琺瑯花卉紋小碟 對組', brand: '琺瑯作', price: 2280, off: 0, cat: '琺瑯器', material: '銅胎畫琺瑯 · 手繪填彩', source: '圖稿取自清畫琺瑯花卉盤', dims: '高 1.3 公分、口徑 10.5 公分、足徑 8.5 公分', rating: 4.6, reviews: 66, listedAt: '2026-06-11' },
  { id: 'qc-13', name: '玉璧紋樣白玉紙鎮', brand: '玉作齋', price: 2980, off: 0, cat: '玉器', material: '和田青白玉 · 手工琢磨', source: '器型取自漢代穀紋玉璧', dims: '直徑 8.6 公分、厚 0.9 公分', rating: 4.8, reviews: 52, listedAt: '2026-09-02' },
  { id: 'qc-14', name: '雲紋玉佩', brand: '玉作齋', price: 1680, off: 0.15, cat: '玉器', material: '青玉 · 蠶絲繩結', source: '紋樣取自戰國雲紋玉佩', dims: '佩身 3.4 × 5.2 公分、繩長可調 42–56 公分', rating: 4.7, reviews: 118, listedAt: '2026-09-05' },
  { id: 'qc-15', name: '剔紅牡丹紋方盤', brand: '漆藝所', price: 3880, off: 0.2, cat: '漆器', material: '天然生漆 · 剔紅雕漆', source: '刀工參考明永樂剔紅漆盤', dims: '25.75 × 25.75 公分、高 2.4 公分', rating: 4.9, reviews: 44, listedAt: '2026-07-01' },
  { id: 'qc-16', name: '黑漆嵌螺鈿名片盒', brand: '漆藝所', price: 1580, off: 0, cat: '漆器', material: '木胎黑漆 · 螺鈿鑲嵌', source: '工法參考清代嵌螺鈿文具', dims: '9.8 × 6.2 公分、高 1.2 公分', rating: 4.6, reviews: 87, listedAt: '2026-06-25' },
  { id: 'qc-17', name: '清明上河圖全卷', brand: '書畫工房', price: 3880, off: 0.2, cat: '繪畫', material: '宣紙微噴 · 實木收納盒', source: '原件為北宋張擇端絹本設色長卷', dims: '25.75 × 208.8 公分', rating: 4.9, reviews: 386, listedAt: '2026-08-15' },
  { id: 'qc-18', name: '敦煌藻井紋樣拼圖 1000 片', brand: '紋樣製作', price: 1180, off: 0.3, cat: '繪畫', material: '灰板紙 · 消光面處理', source: '圖稿取自莫高窟窟頂藻井', dims: '完成尺寸 50.0 × 70.0 公分', rating: 4.7, reviews: 342, listedAt: '2026-08-20' },
  { id: 'qc-19', name: '宋畫花鳥冊頁', brand: '書畫工房', price: 2180, off: 0.1, cat: '繪畫', material: '絹本微噴 · 綾邊裝裱', source: '原件為宋人花鳥冊頁', dims: '待測量', rating: 4.6, reviews: 158, listedAt: '2026-07-10' },
];

/** 商品現在都是同尺寸明信片；文物原始尺寸保留在背面說明，不再把它誤當成商品尺寸。 */
export const POSTCARD_SIZE = 'A6 明信片（148 × 105 mm）';
const POSTCARD_MATERIAL = '220g 非塗佈卡紙 · 雙面印刷';
const CATEGORY_IMAGES: Record<string, string> = {
  '青銅器': '/media/catalog/bronze/中銅000001N000000000/display.jpg',
  '雕刻': '/media/catalog/carving/中日雕000005N000000000/display.jpg',
  '陶瓷': '/media/catalog/ceramic/中日瓷000005N000000000/display.jpg',
  '錢幣': '/media/catalog/coin/購錢000214N000000000/display.jpg',
  '琺瑯器': '/media/catalog/enamel/中琺000001N000000000/display.jpg',
  '玉器': '/media/catalog/jade/中玉000001N000000000/display.jpg',
  '漆器': '/media/catalog/lacquer/中漆000001N000000000/display.jpg',
  '繪畫': '/media/catalog/painting/中畫00002300002/display.jpg',
};

function toPostcardName(name: string): string {
  return `${name
    .replace('拼圖 1000 片', '')
    .replace(/\s+/gu, ' ')
    .trim()}文物明信片`;
}

/**
 * 讓保留中的小型 mock 型錄也走正式商品契約：所有卡片實體同為 A6，
 * 只有原作尺寸與主圖內容不同；主圖方向由前端依自然寬高自動判斷橫式／直式。
 */
export const CATALOG: CatalogRecord[] = SOURCE_CATALOG.map((record) => ({
  ...record,
  name: toPostcardName(record.name),
  artifactDims: record.dims,
  dims: POSTCARD_SIZE,
  material: POSTCARD_MATERIAL,
  image: CATEGORY_IMAGES[record.cat],
}));

/** 器類（順序即各頁面分類清單的顯示順序） */
export const CATEGORIES: { id: string; name: string }[] = [
  { id: 'bronze', name: '青銅器' },
  { id: 'carving', name: '雕刻' },
  { id: 'ceramic', name: '陶瓷' },
  { id: 'coin', name: '錢幣' },
  { id: 'enamel', name: '琺瑯器' },
  { id: 'jade', name: '玉器' },
  { id: 'lacquer', name: '漆器' },
  { id: 'painting', name: '繪畫' },
];

/** 尺寸尚未建檔的商品，dims 欄位所使用的標示文字 */
export const DIMS_PENDING = '待測量';

/** 已售件數的示意換算基數與級距（依商品在型錄中的序號換算，正式應由訂單統計提供） */
export const SOLD_BASE = 320;
export const SOLD_STEP = 137;

/** 假 API 回應商品庫存的固定值（型錄尚無庫存欄位，對應後端 products.stock） */
export const MOCK_STOCK = 20;

/** 商品圖片的視角名稱；詳情頁主圖使用文物明信片，列表仍只使用靜態圖片。 */
export const GALLERY_VIEWS = ['正面', '紙材細節', '背面', '包裝'];

/** 商品出貨說明 */
export const SHIPPING_NOTE = '下單後 2 個工作日內出貨，附來源與考據說明卡';

/** 商品說明段落：接在商品出處說明之後的共通敘述 */
export const DESCRIPTION_SUFFIX =
  '。本商品是固定 A6 尺寸的文物明信片（148 × 105 mm），依主圖原始寬高自動選擇橫式或直式；正面呈現文物圖像，背面整理名稱、類型與來源資訊，明確與原作文物本體區隔。固定尺寸適合放入收藏冊、展示架或書桌，也能在背面寫下短訊息寄給親朋好友；實際寄送仍依當地郵務規定辦理。';

/** 尺寸尚在建檔時的商品狀態說明 */
export const CONDITION_PENDING = '明信片資料尚在建檔；先以固定 A6 成品尺寸展示，附來源與考據說明卡。';
/** 已完成尺寸量測的商品狀態說明 */
export const CONDITION_MEASURED =
  '固定 A6 成品尺寸，紙材與印刷色澤可能因螢幕及批次略有差異，屬正常狀態；附來源與考據說明卡。';

/** 商品評價示意資料（每件商品皆回傳同一組） */
export const REVIEWS: Review[] = [
  { id: 'rv-01', stars: 5, user: '藏家 L***n', date: '2026-08-29', hasPhoto: true, text: '紋樣印製比想像中細緻，說明卡把原件年代與館藏編號都寫清楚了，送禮很有面子。' },
  { id: 'rv-02', stars: 5, user: '藏家 C***h', date: '2026-08-14', hasPhoto: false, text: '包裝厚實，運送沒有碰傷。實物顏色比商品圖再沉穩一點，我個人更喜歡。' },
  { id: 'rv-03', stars: 4, user: '藏家 W***y', date: '2026-07-30', hasPhoto: true, text: '品質沒問題，尺寸與頁面標示一致，只是希望出貨再快一點。客服回覆很迅速。' },
  { id: 'rv-04', stars: 4, user: '藏家 T***c', date: '2026-07-11', hasPhoto: false, text: '做工扎實，細部的收邊如果再修一點會更好，整體仍值得這個價格。' },
  { id: 'rv-05', stars: 3, user: '藏家 H***j', date: '2026-06-22', hasPhoto: false, text: '紋樣還原度不錯，但我收到的那件釉面有一小處針孔，客服補寄了說明卡。' },
];

/* ===============================
   首頁與行銷內容
   =============================== */

export const HERO_SLIDES: HeroSlide[] = [
  { slot: '[ 主視覺 1 · 青花瓷器情境 1600×840 ]', kicker: 'SPECIAL EXHIBITION / 特展聯名', title: '青花千年\n上桌日用', desc: '館藏紋樣授權復刻，杯壺盤器 128 款，第二件 8 折。' },
  { slot: '[ 主視覺 2 · 書畫明信片平拍 1600×840 ]', kicker: 'SCROLL SERIES / 書畫系列', title: '把長卷\n收進書桌', desc: '清明上河圖文物明信片，附來源與考據說明。' },
  { slot: '[ 主視覺 3 · 藏家日 1600×840 ]', kicker: 'MEMBER DAY / 藏家日', title: '每月 8 號\n藏家專屬 9 折', desc: '入會即享鑑賞講座名額，滿額回饋 3% 購物金。' },
];

/** 限時特賣品項與剩餘庫存比例 */
export const FLASH_SALE_ITEMS: { productId: string; stockRatio: number }[] = [
  { productId: 'qc-01', stockRatio: 0.72 },
  { productId: 'qc-09', stockRatio: 0.38 },
  { productId: 'qc-15', stockRatio: 0.16 },
];

/** 限時特賣距離結束的時間（每次請求重新起算） */
export const FLASH_SALE_REMAINING_MS = (3 * 3600 + 42 * 60 + 15) * 1000;

export const BRANDS: Brand[] = [
  { en: 'QMAH SELECT', zh: '清明選物', deal: '特展聯名 8 折' },
  { en: 'SCROLL WORKS', zh: '書畫工房', deal: '新品 9 折' },
  { en: 'RU KILN', zh: '窯作研究', deal: '對杯免運' },
  { en: 'SILK WORKS', zh: '織紋復刻', deal: '第二件半價' },
  { en: 'BRONZE HALL', zh: '金石堂號', deal: '滿額送拓印卡' },
  { en: 'INCENSE CO.', zh: '香道處', deal: '加贈香品組' },
];

/** 「為你推薦」的商品順序，未列出的商品依型錄順序接在後面（正式應由推薦演算法產生） */
export const RECOMMENDATION_ORDER = ['qc-04', 'qc-06', 'qc-09', 'qc-03', 'qc-12', 'qc-07', 'qc-10', 'qc-05', 'qc-01', 'qc-08'];

/** 依序輪流套用的推薦理由 */
export const RECOMMENDATION_REASONS = ['近期熱門', '回購率高', '同類最低'];

/** 首頁側欄可領取的折價券 */
export const CLAIMABLE_COUPONS: Coupon[] = [
  { id: 'claim-100', off: '$100', title: '新客折抵券', cond: '滿 $1,000 可用', min: 1000, kind: 'amount', value: 100, cap: null, due: null },
  { id: 'claim-300', off: '$300', title: '藏家日折抵券', cond: '滿 $2,500 可用', min: 2500, kind: 'amount', value: 300, cap: null, due: null },
  { id: 'claim-member-day', off: '9 折', title: '藏家日 9 折券', cond: '藏家日限定', min: 0, kind: 'percent', value: 0.1, cap: null, due: null },
];

/* ===============================
   搜尋
   =============================== */

export const HOT_SEARCH_LINKS: HotSearchLink[] = [
  { label: '青花蓋杯', href: '#' },
  { label: '清明上河圖', href: '#' },
  { label: '掐絲琺瑯', href: '#' },
  { label: '黃銅書籤', href: '#' },
  { label: '香道器具', href: '#' },
];

/** 搜尋建議：接在輸入關鍵字之後的字尾（示意資料，正式應比對商品名稱產生） */
export const SUGGESTION_SUFFIXES = ['文物明信片', '器物', '書畫', '文具', '明信片'];

/** 搜尋建議件數的示意換算基數與級距 */
export const SUGGESTION_COUNT_BASE = 860;
export const SUGGESTION_COUNT_STEP = 137;

/* ===============================
   會員
   =============================== */

export const MEMBER: MemberProfile = {
  name: '王承翊',
  phone: '0912-345-678',
  email: 'chengyi.w@example.com',
  taxId: '24681357',
  address: '台北市中正區重慶南路一段 122 號 5 樓',
  note: '平日下午收件，需禮盒包裝',
  pointBalance: 1860,
};

/** 會員持有的折價券 */
export const MEMBER_COUPONS: Coupon[] = [
  { id: 'cp-newcomer', off: '$100', title: '新客折抵券', cond: '滿 $1,000 可用', min: 1000, kind: 'amount', value: 100, cap: null, due: '2026-12-31' },
  { id: 'cp-member-day', off: '$300', title: '藏家日折抵券', cond: '滿 $2,500 可用', min: 2500, kind: 'amount', value: 300, cap: null, due: '2026-10-08' },
  { id: 'cp-ten-off', off: '9 折', title: '全站 9 折券', cond: '滿 $3,000 可用，最高折 $800', min: 3000, kind: 'percent', value: 0.1, cap: 800, due: null },
  { id: 'cp-freeship', off: '免運', title: '免運券', cond: '不限金額', min: 0, kind: 'freeship', value: 0, cap: null, due: '2026-11-30' },
];

/* ===============================
   購物車與結帳
   =============================== */

/** 「再加購」推薦的商品數量上限 */
export const ADDON_LIMIT = 5;

/** 購物車內容（商品 ID 對應數量），示意使用者先前已加入購物車的商品 */
export const cartQuantities = new Map<string, number>([
  ['qc-01', 1],
  ['qc-15', 1],
  ['qc-13', 2],
]);

export const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: 'home-delivery', name: '宅配到府', fee: 120 },
  { id: 'cvs-pickup', name: '超商取貨', fee: 60 },
  { id: 'store-pickup', name: '門市自取', fee: 0 },
];

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'credit-once', name: '信用卡一次付清' },
  { id: 'credit-24', name: '24 期零利率' },
  { id: 'cod', name: '貨到付款' },
  { id: 'mobile-pay', name: '行動支付' },
];

export const FREE_SHIPPING_THRESHOLD = 1200;
export const POINT_EARN_RATE = 0.03;

/* ===============================
   全站設定
   =============================== */

export const SITE_CONFIG: SiteConfig = {
  promoAnnouncements: ['滿 $1,200 免運', '30 天退換', '附考據說明卡'],
  footerColumns: [
    { title: 'SHOP', links: [{ label: '全部分類', href: '#' }, { label: '特展聯名', href: '#' }, { label: '品牌館', href: '#' }, { label: '典藏禮盒', href: '#' }] },
    { title: 'SERVICE', links: [{ label: '運送與付款', href: '#' }, { label: '退換貨政策', href: '#' }, { label: '保養與收藏', href: '#' }, { label: '常見問題', href: '#' }] },
    { title: 'ABOUT', links: [{ label: '關於清明鑑定屋', href: '#' }, { label: '授權與考據', href: '#' }, { label: '實體展售點', href: '#' }, { label: '鑑賞講座', href: '#' }] },
  ],
  productPolicies: [
    { label: '保養', text: '避免長時間日照與高溫；陶瓷與琺瑯器請勿以鋼刷清洗。' },
    { label: '退換', text: '收到商品 30 天內可退換，需保留原包裝與說明卡。' },
    { label: '鑑定', text: '可預約門市鑑賞講座，現場比對原件圖版。' },
  ],
  sizeNote:
    '尺寸為手工量測值，單件可能有 ±2 公厘誤差；標示「待測量」者以出貨前實測資料為準，可於下單後索取。',
};
