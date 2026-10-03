export interface ScatteredPiece { x: number; y: number; width: number; height: number; turn: number; }

/** Stable stratified scatter with limited overlap. Remaining pieces never repack. */
export function scatterPieces(count: number, width: number, height: number, ratio: number, seed = 1271) {
  if (count < 1 || width <= 0 || height <= 0 || ratio <= 0) return { columns: 1, pieces: [] as ScatteredPiece[] };
  const padding = 12;
  const spaceWidth = Math.max(1, width - padding * 2);
  const spaceHeight = Math.max(1, height - padding * 2);
  let columns = 1;
  let pieceWidth = 0;
  for (let candidate = 1; candidate <= count; candidate++) {
    const size = Math.min(spaceWidth / candidate * .94, spaceHeight / Math.ceil(count / candidate) * ratio * 1.13);
    if (size > pieceWidth) { pieceWidth = size; columns = candidate; }
  }
  const rows = Math.ceil(count / columns);
  const cellWidth = spaceWidth / columns;
  const cellHeight = spaceHeight / rows;
  const pieceHeight = pieceWidth / ratio;
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const pieces: ScatteredPiece[] = [];
  for (let index = 0; index < count; index++) {
    const turn = (random() - .5) * 24;
    const radians = Math.abs(turn) * Math.PI / 180;
    const halfWidth = (pieceWidth * Math.cos(radians) + pieceHeight * Math.sin(radians)) / 2;
    const halfHeight = (pieceHeight * Math.cos(radians) + pieceWidth * Math.sin(radians)) / 2;
    const centerX = padding + (index % columns + .5) * cellWidth + (random() - .5) * cellWidth * .32;
    const centerY = padding + (Math.floor(index / columns) + .5) * cellHeight + (random() - .5) * cellHeight * .18;
    const x = Math.max(halfWidth, Math.min(width - halfWidth, centerX));
    const y = Math.max(halfHeight, Math.min(height - halfHeight, centerY));
    pieces.push({ x: (x - pieceWidth / 2) / width * 100, y: (y - pieceHeight / 2) / height * 100,
      width: pieceWidth / width * 100, height: pieceHeight / height * 100, turn });
  }
  return { columns, pieces };
}
