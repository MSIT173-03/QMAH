/** 金額格式化為 $ 開頭、千分位字串 */
export function formatMoney(value: number): string {
  return '$' + value.toLocaleString('en-US');
}

/** 將 ISO 日期（YYYY-MM-DD）格式化為 MM/DD */
export function formatDateMD(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
}
