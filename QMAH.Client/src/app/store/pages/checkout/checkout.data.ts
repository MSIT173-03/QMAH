import { CartItem, Coupon, MemberProfile, Recipient } from '../../api/api.models';

/**
 * 結帳頁面的頁面選項定義與換算規則。
 * 購物車內容、會員資料、配送／付款方式、折價券與點數規則皆由 API 取得（見 src/app/api）；
 * 本檔僅存放結帳流程的表單設定，以及下單前即時試算用的純函式——
 * 正式金額以 POST /orders 的回應為準，後端會依相同規則重新計算。
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

/** 收件資訊表單內容 */
export interface CheckoutForm {
  /** 收件人姓名（必填） */
  name: string;
  /** 聯絡電話（必填） */
  phone: string;
  /** 電子信箱 */
  email: string;
  /** 發票統編（選填） */
  tax: string;
  /** 收件地址（必填） */
  addr: string;
  /** 給客服的備註（選填） */
  note: string;
}

/** 收件資訊表單的欄位名稱 */
export type CheckoutFormField = keyof CheckoutForm;

/** 收件資訊表單的初始（空白）內容 */
export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  name: '',
  phone: '',
  email: '',
  tax: '',
  addr: '',
  note: '',
};

/** 以會員資料填入收件資訊表單（「帶入個人資料」） */
export function profileToForm(profile: MemberProfile): CheckoutForm {
  return {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    tax: profile.taxId,
    addr: profile.address,
    note: profile.note,
  };
}

/** 將收件資訊表單轉為送出訂單用的收件資訊 */
export function formToRecipient(form: CheckoutForm): Recipient {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    taxId: form.tax,
    address: form.addr,
    note: form.note,
  };
}

/** 收件資訊的單一欄位定義（版面固定，非後端資料） */
export interface RecipientFieldDef {
  /** 對應 CheckoutForm 的欄位名稱 */
  field: CheckoutFormField;
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
  { field: 'tax', label: '發票統編（選填）', placeholder: '8 位數字' },
];

/** 佔滿整列的收件地址欄位 */
export const RECIPIENT_ADDR_FIELD: RecipientFieldDef = {
  field: 'addr',
  label: '收件地址',
  placeholder: '台北市中正區重慶南路一段 122 號',
};

/** 佔滿整列的備註欄位（多行輸入） */
export const RECIPIENT_NOTE_FIELD: RecipientFieldDef = {
  field: 'note',
  label: '給客服的備註（選填）',
  placeholder: '例：需要禮盒包裝、平日下午收件',
};

/** 送出訂單前必須填寫的欄位 */
const REQUIRED_FIELDS: CheckoutFormField[] = ['name', 'phone', 'addr'];

/** 收件資訊是否已填妥必填欄位 */
export function isCheckoutFormValid(form: CheckoutForm): boolean {
  return REQUIRED_FIELDS.every((field) => form[field].trim() !== '');
}

/* ===============================
   折價券試算
   =============================== */

/** 未選用任何折價券時的索引值 */
export const NO_COUPON = -1;

/** 折價券在目前應付金額下的折抵金額；未達門檻或免運券皆不折抵商品金額 */
export function couponDiscount(coupon: Coupon | null, payable: number): number {
  if (!coupon || payable < coupon.min) return 0;
  if (coupon.kind === 'amount') return coupon.value;
  if (coupon.kind === 'percent') return Math.min(coupon.cap ?? Infinity, Math.round(payable * coupon.value));
  return 0;
}

/** 折價券是否免除運費（未達門檻則不生效） */
export function couponFreesShipping(coupon: Coupon | null, payable: number): boolean {
  return !!coupon && coupon.kind === 'freeship' && payable >= coupon.min;
}

/* ===============================
   購物點數試算
   =============================== */

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

/** 本次可折抵點數上限：持有點數與應付金額取小者 */
export function pointCap(balance: number, payable: number): number {
  return Math.min(balance, payable);
}

/** 依折抵方式換算實際折抵點數；自訂數量會被夾在 0 與可折抵上限之間 */
export function resolveUsedPoints(mode: PointMode, customPoints: string, cap: number): number {
  if (mode === 'max') return cap;
  if (mode !== 'custom') return 0;
  return Math.min(Math.max(0, parseInt(customPoints || '0', 10) || 0), cap);
}

/* ===============================
   訂單商品行
   =============================== */

/** 供訂單摘要顯示用的商品行資料 */
export interface CheckoutLineData {
  id: string;
  name: string;
  qty: number;
  /** 折扣後單價 */
  price: number;
  /** 折扣前原價，無折扣時為 null */
  was: number | null;
}

/** 依購物車品項換算成訂單商品行資料 */
export function toCheckoutLineData(item: CartItem): CheckoutLineData {
  return {
    id: item.productId,
    name: item.name,
    qty: item.qty,
    price: item.price,
    was: item.originalPrice,
  };
}

/** 商品小計（折扣前金額加總） */
export function sumSubtotal(lines: readonly CheckoutLineData[]): number {
  return lines.reduce((sum, line) => sum + (line.was ?? line.price) * line.qty, 0);
}

/** 應付商品金額（折扣後金額加總） */
export function sumPayable(lines: readonly CheckoutLineData[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}
