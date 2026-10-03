import { describe, expect, it } from 'vitest';
import { locatorCorrect, locatorTarget, validLocatorAnswer } from './game-detail-locator';

describe('文物定位契約', () => {
  it('與 .NET 驗證器的固定向量一致，大小寫 GUID 得到同一位置', () => {
    const expected = [[.5, .6], [.3, .3], [.7, .3], [.5, .3]];
    expected.forEach(([x, y], index) => {
      const id = `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
      expect(locatorTarget('v4-test', id)).toEqual({ x, y });
    });
    const id = 'ABCD0000-0000-0000-0000-000000000001';
    expect(locatorTarget('seed', id)).toEqual(locatorTarget('seed', id.toLowerCase()));
  });
  it('接受細節中心附近的位置，拒絕不相干的位置和非法座標', () => {
    const artifactId = '00000000-0000-0000-0000-000000000001';
    expect(locatorCorrect('v4-test', { artifactId, imageWidth: 1000, imageHeight: 1000, x: .58, y: .68 })).toBe(true);
    expect(locatorCorrect('v4-test', { artifactId, imageWidth: 1000, imageHeight: 1000, x: .61, y: .6 })).toBe(false);
    expect(validLocatorAnswer({ artifactId, imageWidth: 1000, imageHeight: 1000, x: NaN, y: .5 })).toBe(false);
    expect(validLocatorAnswer({ artifactId, imageWidth: 1000, imageHeight: 1000, x: -.1, y: .5 })).toBe(false);
  });
});
