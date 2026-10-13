/**
 * 折價券的色彩規則（商城兌換商店、我的折價券、會員中心共用）：
 * 券種決定色相——現金折抵＝金、折扣券＝靛藍；面額越大色階越深（三檔）。
 * 只看券面上的折抵文字（例如「NT$150」「15% OFF」），所以三個地方不會各自為政。
 */
export interface CouponTone {
  kind: 'cash' | 'percent';
  tier: 1 | 2 | 3;
}

export function couponToneOf(off: string): CouponTone {
  const percent = off.includes('%');
  const value = Number.parseFloat(off.replace(/[^\d.]/g, '')) || 0;
  const [low, high] = percent ? [10, 15] : [100, 300];
  return { kind: percent ? 'percent' : 'cash', tier: value < low ? 1 : value < high ? 2 : 3 };
}
