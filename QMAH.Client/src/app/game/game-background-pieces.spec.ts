import { describe, expect, it } from 'vitest';
import { findBackgroundPieces } from './game-background-pieces';

function image(width = 30, height = 30) {
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (left: number, top: number, right: number, bottom: number, color: number) => {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = color;
    }
  };
  return { pixels, paint };
}

describe('背景候選碎片', () => {
  it.each([[5, 5], [5, 3], [3, 5]])('在 %i×%i 盤面保留貼近格線的彩色細線', (columns, rows) => {
    const width = columns * 20, height = rows * 20;
    const { pixels } = image(width, height);
    // 只改綠色通道，確保彩色筆跡不會因灰階亮度接近背景而被忽略。
    for (let y = 2; y < 18; y++) pixels[(y * width + 19) * 4 + 1] = 220;
    const candidates = findBackgroundPieces(pixels, width, height, columns, rows);
    expect(candidates).not.toContain(0);
    expect(candidates).toContain(1);
  });
  it('保留中央圖案，只列出連接外框的空白片', () => {
    const { pixels, paint } = image();
    paint(10, 10, 20, 20, 80);
    expect(findBackgroundPieces(pixels, 30, 30, 3, 3)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
  it('保留淡墨細線，容忍沒有內容的平緩紙色漸層', () => {
    const { pixels, paint } = image();
    paint(1, 1, 9, 2, 225);
    for (let x = 10; x < 20; x++) paint(x, 0, x + 1, 10, 245 + (x - 10));
    const pieces = findBackgroundPieces(pixels, 30, 30, 3, 3);
    expect(pieces).not.toContain(0);
    expect(pieces).toContain(1);
  });
  it('中央留白被圖案包圍時不會當成外框背景', () => {
    const { pixels, paint } = image();
    paint(10, 0, 20, 10, 80);
    paint(0, 10, 10, 20, 80);
    paint(20, 10, 30, 20, 80);
    paint(10, 20, 20, 30, 80);
    expect(findBackgroundPieces(pixels, 30, 30, 3, 3)).not.toContain(4);
  });
  it('圖片太小或像素資料不完整時不猜測背景', () => {
    expect(findBackgroundPieces(new Uint8ClampedArray(4), 30, 30, 3, 3)).toEqual([]);
    expect(findBackgroundPieces(new Uint8ClampedArray(36), 3, 3, 3, 3)).toEqual([]);
  });
  it('深色外框也可辨識，不把顏色不同的平坦文物當成背景', () => {
    const { pixels, paint } = image();
    paint(0, 0, 30, 30, 40);
    paint(10, 10, 20, 20, 100);
    expect(findBackgroundPieces(pixels, 30, 30, 3, 3)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
  it('背景打光由深到淺時，依同一列外框色判斷，仍保留中央文物', () => {
    const { pixels, paint } = image(90, 90);
    for (let y = 0; y < 90; y++) paint(0, y, 90, y + 1, 80 + y);
    paint(30, 30, 60, 60, 20);
    expect(findBackgroundPieces(pixels, 90, 90, 3, 3)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
});
