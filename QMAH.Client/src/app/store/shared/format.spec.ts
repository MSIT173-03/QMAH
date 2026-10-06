import { formatCouponCondition, formatCouponOff, formatDateTime } from './format';

describe('formatDateTime', () => {
  it('treats a time without a zone as UTC and shows it in local time', () => {
    const local = new Date('2026-10-06T02:30:00Z');
    const pad = (value: number) => String(value).padStart(2, '0');
    const expected = `${local.getFullYear()}.${pad(local.getMonth() + 1)}.${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}`;

    expect(formatDateTime('2026-10-06T02:30:00')).toBe(expected);
    expect(formatDateTime('2026-10-06T02:30:00Z')).toBe(expected);
  });
});

describe('coupon labels', () => {
  it('shows PERCENT discounts as a percentage and FIXED discounts as an amount', () => {
    expect(formatCouponOff('PERCENT', 10)).toBe('10% OFF');
    expect(formatCouponOff('percent', 15)).toBe('15% OFF');
    expect(formatCouponOff('FIXED', 350)).toBe('NT$350');
  });

  it('tolerates decimal strings from the API', () => {
    // 後端 decimal 在 JSON 可能是 20 或 20.00；Number() 之後兩者顯示相同。
    expect(formatCouponOff('FIXED', '20.00' as unknown as number)).toBe('NT$20');
  });

  it('states the minimum spend only when there is one', () => {
    expect(formatCouponCondition(1000)).toBe('最低消費 NT$1000');
    expect(formatCouponCondition(0)).toBe('不限金額');
  });
});
