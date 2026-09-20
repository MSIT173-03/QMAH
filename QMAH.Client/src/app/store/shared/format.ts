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

/** 將 ISO 日期（YYYY-MM-DD）格式化為 MM/DD */
export function formatDateMD(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
}

/** 數字補零至兩位，用於排行角標、倒數計時與步驟序號 */
export function pad(value: number): string {
  return String(value).padStart(2, '0');
}
