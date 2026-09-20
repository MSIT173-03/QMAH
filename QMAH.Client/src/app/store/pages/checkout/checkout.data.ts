import { Recipient } from '../../api/api.models';

/**
 * 結帳頁面的頁面選項定義與換算規則。
 * 購物車內容、會員資料、配送／付款方式、折價券與點數規則皆由 API 取得（見 store/api）；
 * 所有金額（運費、折價券與點數折抵、應付總額）皆由 POST /checkout/quote 試算、POST /orders 確定，
 * 本檔僅存放結帳流程的表單設定與選項定義。
 */

/* ===============================
   結帳流程步驟
   =============================== */

/** 結帳流程的步驟名稱，順序即流程順序（序號由 app-step-indicator 依索引自動加上） */
export const CHECKOUT_STEPS = ['購物車', '結帳', '完成'];

/** 結帳頁在流程中的步驟索引（第 2 步） */
export const CHECKOUT_STEP_INDEX = 1;

/* ===============================
   收件資訊表單
   =============================== */

/** 收件資訊表單的欄位名稱（表單內容直接使用送出訂單的 Recipient 格式） */
export type RecipientField = keyof Recipient;

/** 收件資訊表單的初始（空白）內容 */
export const EMPTY_RECIPIENT: Recipient = {
  name: '',
  phone: '',
  email: '',
  taxId: '',
  address: '',
  note: '',
};

/** 只取出收件資訊欄位（例如由會員資料「帶入個人資料」時，排除點數等其他欄位） */
export function toRecipient(source: Recipient): Recipient {
  return {
    name: source.name,
    phone: source.phone,
    email: source.email,
    taxId: source.taxId,
    address: source.address,
    note: source.note,
  };
}

/** 收件資訊的單一欄位定義（版面固定，非後端資料） */
export interface RecipientFieldDef {
  /** 對應 Recipient 的欄位名稱 */
  field: RecipientField;
  /** 欄位標題 */
  label: string;
  /** 未填寫時的提示文字 */
  placeholder: string;
}

/** 以雙欄格狀排列的短欄位 */
export const RECIPIENT_GRID_FIELDS: RecipientFieldDef[] = [
  { field: 'name', label: '收件人姓名', placeholder: '王小明' },
  { field: 'phone', label: '聯絡電話', placeholder: '0912-345-678' },
  { field: 'email', label: '電子信箱', placeholder: 'name@example.com' },
  { field: 'taxId', label: '發票統編（選填）', placeholder: '8 位數字' },
];

/** 佔滿整列的收件地址欄位 */
export const RECIPIENT_ADDR_FIELD: RecipientFieldDef = {
  field: 'address',
  label: '收件地址',
  placeholder: '台北市中正區重慶南路一段 122 號',
};

/** 佔滿整列的備註欄位（多行輸入） */
export const RECIPIENT_NOTE_FIELD: RecipientFieldDef = {
  field: 'note',
  label: '訂單備註（選填）',
  placeholder: '例：需要禮盒包裝、平日下午收件',
};

/** 送出訂單前必須填寫的欄位 */
const REQUIRED_FIELDS: RecipientField[] = ['name', 'phone', 'address'];

/** 收件資訊是否已填妥必填欄位 */
export function isRecipientValid(recipient: Recipient): boolean {
  return REQUIRED_FIELDS.every((field) => recipient[field].trim() !== '');
}

/* ===============================
   折價券與購物點數
   =============================== */

/** 未選用任何折價券時的索引值 */
export const NO_COUPON = -1;

/** 點數折抵方式 */
export type PointMode =
  /** 不折抵 */
  | 'none'
  /** 折抵至上限 */
  | 'max'
  /** 由使用者自訂折抵點數 */
  | 'custom';

/** 點數折抵方式的顯示順序 */
export const POINT_MODES: PointMode[] = ['none', 'max', 'custom'];

/**
 * 依折抵方式換算要向後端申請折抵的點數；實際折抵點數與上限由後端夾限後回傳。
 * 折抵至上限時直接申請全部持有點數，由後端夾在可折抵上限內。
 */
export function requestedPoints(mode: PointMode, customPoints: string, balance: number): number {
  if (mode === 'max') return balance;
  if (mode === 'custom') return parseInt(customPoints || '0', 10) || 0;
  return 0;
}
