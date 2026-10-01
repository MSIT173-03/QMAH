import { scrollGeometry } from './game-scroll-board.component';

describe('scrollGeometry', () => {
  it('uses a five by three rectangle for landscape paintings', () => {
    expect(scrollGeometry(3080, 2036)).toEqual({ horizontal: true, ratio: 3080 / 2036, eligible: true, columns: 5, rows: 3 });
  });

  it('uses a three by five rectangle for portrait paintings without stretching', () => {
    expect(scrollGeometry(300, 600)).toEqual({ horizontal: false, ratio: .5, eligible: true, columns: 3, rows: 5 });
  });

  it('rejects extremely long paintings instead of cropping them', () => {
    expect(scrollGeometry(2499, 150).eligible).toBe(false);
    expect(scrollGeometry(150, 2499).eligible).toBe(false);
    expect(scrollGeometry(2200, 1000).eligible).toBe(true);
    expect(scrollGeometry(2201, 1000).eligible).toBe(false);
  });
});
