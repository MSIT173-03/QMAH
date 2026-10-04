import { describe, expect, it } from 'vitest';
import { chooseLocatorTarget, locatorCorrect, locatorTarget, validLocatorAnswer } from './game-detail-locator';

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
  it('不採信答案自行指定的目標點', () => {
    const artifactId = '00000000-0000-0000-0000-000000000001';
    const answer = { artifactId, imageWidth: 1000, imageHeight: 1000, x: .4, y: .4, targetX: .41, targetY: .39 };
    expect(locatorCorrect('v4-test', answer)).toBe(false);
    expect(validLocatorAnswer({ ...answer, targetX: 2 })).toBe(false);
  });
  it('目標點落在文物本體，不落在空白背景', () => {
    const width = 200, height = 200, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    // 左下角一塊深色文物，其餘是白背景
    for (let y = 100; y < 190; y++) for (let x = 20; x < 100; x++) { const o = (y * width + x) * 4; pixels[o] = 40; pixels[o + 1] = 30; pixels[o + 2] = 20; }
    for (const id of ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']) {
      const target = chooseLocatorTarget('v5-test', id, pixels, width, height)!;
      expect(target.x).toBeGreaterThan(.2); expect(target.x).toBeLessThan(.5);
      expect(target.y).toBeGreaterThan(.5);
    }
  });
});
