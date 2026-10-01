/** 數字格式化為千分位字串 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** 金額格式化為 $ 開頭、千分位字串 */
export function formatMoney(value: number): string {
  return '$' + formatNumber(value);
}

/** 折抵金額：大於 0 時以負號呈現，否則顯示 $0 */
export function formatCut(amount: number): string {
  return amount > 0 ? '−' + formatMoney(amount) : formatMoney(0);
}

/** 運費：0 時顯示「免運」 */
export function formatShippingFee(fee: number): string {
  return fee === 0 ? '免運' : formatMoney(fee);
}

/** 折扣標籤：只有實際低於原價時才產生百分比；一般商品不顯示標籤。 */
export function formatDiscountTag(price: number, was: number | null): string {
  return was !== null && was > price ? `-${Math.round((1 - price / was) * 100)}%` : '';
}

/** 將 ISO 日期（YYYY-MM-DD）或含時間的 ISO 字串（YYYY-MM-DDTHH:mm:ss）格式化為 MM/DD */
export function formatDateMD(iso: string): string {
  // 只取日期部分：API 的建立時間帶有時間，直接依 "-" 切割會把 "DDTHH:mm:ss" 整段當成日。
  const [, month, day] = iso.split('T')[0].split('-');
  return `${month}/${day}`;
}

/** 數字補零至兩位，用於排行角標、倒數計時與步驟序號 */
export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 折價券的折抵幅度標示（券面左側的大字）：PERCENT 的折抵值是百分比（10 代表 10% OFF），
 * 其餘（FIXED）為折抵金額。會員折價券與折價券商店共用，兩邊的標示才會一致。
 */
export function formatCouponOff(discountType: string, discountValue: number): string {
  const value = Number(discountValue);
  return discountType.toUpperCase() === 'PERCENT' ? `${value}% OFF` : `NT$${value}`;
}

/** 折價券的使用條件說明：有最低消費門檻時標出金額，否則「不限金額」 */
export function formatCouponCondition(minimumAmount: number): string {
  const minimum = Number(minimumAmount);
  return minimum > 0 ? `最低消費 NT$${minimum}` : '不限金額';
}
