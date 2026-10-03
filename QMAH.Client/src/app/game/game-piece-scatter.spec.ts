import { describe, expect, it } from 'vitest';
import { scatterPieces } from './game-piece-scatter';

describe('fragment scatter', () => {
  it('is deterministic and retains every piece slot', () => {
    const first = scatterPieces(25, 420, 330, .72);
    expect(first).toEqual(scatterPieces(25, 420, 330, .72));
    expect(first.pieces).toHaveLength(25);
    expect(new Set(first.pieces.map(piece => piece.turn)).size).toBeGreaterThan(20);
  });
  it('keeps rotated fragments within the box for wide and tall images', () => {
    for (const ratio of [.5, .72, 1, 2.2]) {
      for (const count of [15, 25]) {
        for (const piece of scatterPieces(count, 420, 330, ratio).pieces) {
          const w = piece.width / 100 * 420;
          const h = piece.height / 100 * 330;
          expect(w / h).toBeCloseTo(ratio);
          const radians = Math.abs(piece.turn) * Math.PI / 180;
          const halfWidth = (w * Math.cos(radians) + h * Math.sin(radians)) / 2;
          const halfHeight = (h * Math.cos(radians) + w * Math.sin(radians)) / 2;
          const x = piece.x / 100 * 420 + w / 2;
          const y = piece.y / 100 * 330 + h / 2;
          expect(x - halfWidth).toBeGreaterThanOrEqual(-.001);
          expect(y - halfHeight).toBeGreaterThanOrEqual(-.001);
          expect(x + halfWidth).toBeLessThanOrEqual(420.001);
          expect(y + halfHeight).toBeLessThanOrEqual(330.001);
        }
      }
    }
  });
  it('uses large pieces without hiding most of another piece', () => {
    const { pieces } = scatterPieces(25, 420, 330, .72);
    expect(pieces[0].height / 100 * 330).toBeGreaterThan(65);
    for (const a of pieces) for (const b of pieces) {
      if (a === b) continue;
      const overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
        * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      expect(overlap / (a.width * a.height)).toBeLessThan(.35);
    }
  });
});
