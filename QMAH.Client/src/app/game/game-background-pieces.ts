/** 以背景色差、邊緣密度與外框連通面積找出候選，結果仍需由玩家確認。 */
export function findBackgroundPieces(
  pixels: Uint8ClampedArray, width: number, height: number, columns: number, rows: number
): number[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || !Number.isInteger(columns)
    || !Number.isInteger(rows) || columns < 1 || rows < 1 || width < columns * 4
    || height < rows * 4 || pixels.length !== width * height * 4) return [];

  const count = width * height;
  const luminance = new Uint8Array(count);
  const border: number[][] = [[], [], []];
  const color = (pixel: number, channel: number) => {
    const offset = pixel * 4;
    const alpha = pixels[offset + 3] / 255;
    return pixels[offset + channel] * alpha + 255 * (1 - alpha);
  };
  for (let pixel = 0; pixel < count; pixel++) {
    luminance[pixel] = Math.round(.2126 * color(pixel, 0) + .7152 * color(pixel, 1) + .0722 * color(pixel, 2));
    const x = pixel % width, y = Math.floor(pixel / width);
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      for (let channel = 0; channel < 3; channel++) border[channel].push(color(pixel, channel));
    }
  }
  // 中位色容忍外框局部碰到文物，色差容忍紙色漸層與輕微壓縮雜訊。
  const background = border.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
  // 館藏照片常有由上到下的打光漸層，每列兩側的背景可補足單一中位色的限制。
  const leftBackground = new Float32Array(height * 3);
  const rightBackground = new Float32Array(height * 3);
  for (let y = 0; y < height; y++) for (let channel = 0; channel < 3; channel++) {
    const left = [], right = [];
    for (let x = 0; x < Math.min(5, width); x++) {
      left.push(color(y * width + x, channel));
      right.push(color(y * width + width - 1 - x, channel));
    }
    leftBackground[y * 3 + channel] = left.sort((a, b) => a - b)[Math.floor(left.length / 2)];
    rightBackground[y * 3 + channel] = right.sort((a, b) => a - b)[Math.floor(right.length / 2)];
  }
  const mask = new Uint8Array(count);
  const edges = new Uint8Array(count);
  for (let pixel = 0; pixel < count; pixel++) {
    const x = pixel % width, y = Math.floor(pixel / width);
    const horizontal = Math.max(...[0, 1, 2].map(channel => Math.abs(color(pixel - (x > 0 ? 1 : 0), channel) - color(pixel + (x < width - 1 ? 1 : 0), channel))));
    const vertical = Math.max(...[0, 1, 2].map(channel => Math.abs(color(pixel - (y > 0 ? width : 0), channel) - color(pixel + (y < height - 1 ? width : 0), channel))));
    edges[pixel] = horizontal > 8 || vertical > 8 ? 1 : 0;
    const similar = [0, 1, 2].every(channel => {
      const value = color(pixel, channel);
      const localBackground = leftBackground[y * 3 + channel] * (1 - x / (width - 1))
        + rightBackground[y * 3 + channel] * x / (width - 1);
      return Math.abs(value - background[channel]) <= 28 || Math.abs(value - localBackground) <= 28;
    });
    if (similar) mask[pixel] = 1;
  }
  // 從圖片外框泛洪，排除被文物或墨跡包圍的內部平坦色塊。
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  const visit = (pixel: number) => {
    if (mask[pixel] !== 1 || edges[pixel]) return;
    mask[pixel] = 2;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < count - width) visit(pixel + width);
  }
  const candidates: number[] = [];
  for (let piece = 0; piece < columns * rows; piece++) {
    const left = Math.floor(piece % columns * width / columns);
    const right = Math.floor((piece % columns + 1) * width / columns);
    const top = Math.floor(Math.floor(piece / columns) * height / rows);
    const bottom = Math.floor((Math.floor(piece / columns) + 1) * height / rows);
    let backgroundPixels = 0, edgePixels = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const pixel = y * width + x;
      let ownEdge = edges[pixel];
      // 格線外的圖案不算這片的邊緣，避免把鄰片的墨跡誤算進空白片。
      if (x === left || x === right - 1 || y === top || y === bottom - 1) {
        const horizontal = Math.max(...[0, 1, 2].map(channel => Math.abs(color(pixel - (x > left ? 1 : 0), channel) - color(pixel + (x < right - 1 ? 1 : 0), channel))));
        const vertical = Math.max(...[0, 1, 2].map(channel => Math.abs(color(pixel - (y > top ? width : 0), channel) - color(pixel + (y < bottom - 1 ? width : 0), channel))));
        ownEdge = horizontal > 8 || vertical > 8 ? 1 : 0;
      }
      edgePixels += ownEdge;
      const connectedNeighbor = (x > left && mask[pixel - 1] === 2) || (x < right - 1 && mask[pixel + 1] === 2)
        || (y > top && mask[pixel - width] === 2) || (y < bottom - 1 && mask[pixel + width] === 2);
      // 僅補回因鄰片輪廓而被擋住、且與本片背景相連的格線像素，不跨過本片細節。
      if (mask[pixel] === 2 || (mask[pixel] === 1 && edges[pixel] && !ownEdge && connectedNeighbor)) backgroundPixels++;
    }
    const area = (right - left) * (bottom - top);
    if (backgroundPixels / area >= .985 && edgePixels / area <= .005) candidates.push(piece);
  }

  return candidates;
}
