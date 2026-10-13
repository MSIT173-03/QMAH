import { Coupon } from '../api/api.models';
import { formatMoney } from './format';

/** 折價券對指定金額的折抵（百分比券無條件捨去，折抵不超過金額）；缺少折抵資料時為 0 */
export function couponSaving(coupon: Coupon, amount: number): number {
  if (coupon.kind === 'PERCENT') return Math.floor((amount * (coupon.value ?? 0)) / 100);
  if (coupon.kind === 'FIXED') return Math.min(amount, coupon.value ?? 0);
  return 0;
}

export interface CartSuggestion {
  kind: 'coupon' | 'gap' | 'points';
  title: string;
  note: string;
  points: string;
}

/**
 * 購物車的省錢建議（懸浮購物車與頂部購物車面板共用）：
 * 1. 有門檻已達的折價券 → 推薦折抵最多的那張，並預估折後應付；
 * 2. 否則找「再買一點就能用」的券（差額 500 元內）；
 * 3. 點數可直接折抵小額（後端上限 50 點、不超過金額 5%），一併提示。
 */
export function cartSuggestion(coupons: Coupon[], amount: number): CartSuggestion | null {
  if (amount <= 0) return null;
  const usable = coupons
    .filter((coupon) => coupon.min <= amount)
    .map((coupon) => ({ coupon, off: couponSaving(coupon, amount) }))
    .sort((a, b) => b.off - a.off)[0];
  const pointsOff = Math.min(50, Math.floor(amount * 0.05));
  if (usable && usable.off > 0) {
    return {
      kind: 'coupon',
      title: `用「${usable.coupon.title}」折 ${formatMoney(usable.off)}`,
      note: `預估應付 ${formatMoney(amount - usable.off)}，結帳時選擇這張券`,
      points: pointsOff > 0 ? `另可用點數再折最多 ${formatMoney(pointsOff)}` : '',
    };
  }
  const next = coupons
    .filter((coupon) => coupon.min > amount && coupon.min - amount <= 500)
    .map((coupon) => ({ coupon, gap: coupon.min - amount, off: couponSaving(coupon, coupon.min) }))
    .sort((a, b) => a.gap - b.gap)[0];
  if (next) {
    return {
      kind: 'gap',
      title: `再買 ${formatMoney(next.gap)} 就能用「${next.coupon.title}」`,
      note: `可折 ${formatMoney(next.off)}，比現在直接結帳划算`,
      points: pointsOff > 0 ? `結帳時可用點數折最多 ${formatMoney(pointsOff)}` : '',
    };
  }
  return pointsOff > 0
    ? { kind: 'points', title: `用點數折抵最多 ${formatMoney(pointsOff)}`, note: '結帳時在「使用點數」欄輸入即可', points: '' }
    : null;
}
