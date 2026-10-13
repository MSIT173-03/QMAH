/**
 * 折價券的視覺規則（商城兌換商店、我的折價券、會員中心共用）：
 * - 券種決定色相：現金折抵＝金、折扣券＝靛藍（只有兩個色系，不靠深淺分高低）；
 * - 面額分三檔，用券面上的星星數表示（★／★★／★★★），最高檔再加斜紋；
 * - 排序：現金折抵在前、折扣券在後，同券種面額高的在前。
 * 只看券面上的折抵文字（例如「NT$150」「15% OFF」），所以三個地方不會各自為政。
 */
export interface CouponTone {
  kind: 'cash' | 'percent';
  tier: 1 | 2 | 3;
  value: number;
}

export function couponToneOf(off: string): CouponTone {
  const percent = off.includes('%');
  const value = Number.parseFloat(off.replace(/[^\d.]/g, '')) || 0;
  const [low, high] = percent ? [10, 15] : [100, 300];
  return { kind: percent ? 'percent' : 'cash', tier: value < low ? 1 : value < high ? 2 : 3, value };
}

/** 同一到期日、同一狀態下的次序：現金折抵先、折扣券後，同券種面額高的在前 */
export function compareCouponOff(a: string, b: string): number {
  const x = couponToneOf(a);
  const y = couponToneOf(b);
  return (x.kind === y.kind ? 0 : x.kind === 'cash' ? -1 : 1) || y.value - x.value;
}
