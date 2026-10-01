import { describe, expect, it } from 'vitest';
import { placePiece } from './game-placement-board.component';

describe('piece placement', () => {
  it('places a tray piece without changing the source array', () => {
    const order = [-1, -1, -1];
    expect(placePiece(order, 2, 1)).toEqual([-1, 2, -1]);
    expect(order).toEqual([-1, -1, -1]);
  });
  it('returns the displaced piece to the tray instead of swapping', () => {
    expect(placePiece([2, 1, -1], 2, 1)).toEqual([-1, 2, -1]);
  });
  it('rejects out of range pieces', () => {
    expect(placePiece([-1, -1], 3, 0)).toEqual([-1, -1]);
  });
});
