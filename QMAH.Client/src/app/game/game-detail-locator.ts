import { findBackgroundPieces } from './game-background-pieces';

/** 舊存檔可能含 targetX／targetY；計分只採用本輪種子與文物 ID，不採信答案內的目標。 */
export interface LocatorAnswer { artifactId: string; x: number; y: number; imageWidth: number; imageHeight: number; targetX?: number; targetY?: number; }

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0;
  return result;
}

/** 與伺服器共用 FNV-1a 規則，位置只依已保存的種子與文物 ID 產生。 */
export function locatorTarget(seed: string, artifactId: string): { x: number; y: number } {
  const key = `${seed}|${artifactId.toLowerCase()}`;
  return { x: (3 + hash(key) % 5) / 10, y: (3 + hash(`${key}|y`) % 5) / 10 };
}

const GRID = 10;

/**
 * 沿用拼圖的背景偵測，從文物本體上挑目標點：窗口內至少四分之三的格子不是背景，
 * 同一顆種子與文物永遠得到同一點；偵測不到時回傳 null，由舊規則接手。
 */
export function chooseLocatorTarget(seed: string, artifactId: string, pixels: Uint8ClampedArray, width: number, height: number): { x: number; y: number } | null {
  const blank = new Set(findBackgroundPieces(pixels, width, height, GRID, GRID));
  if (blank.size === GRID * GRID) return null;
  const halfX = Math.floor(Math.min(width, height) / 5) / 2 / width;
  const halfY = Math.floor(Math.min(width, height) / 5) / 2 / height;
  const covered = (x: number, y: number) => {
    const c0 = Math.max(0, Math.floor((x - halfX) * GRID)), c1 = Math.min(GRID - 1, Math.ceil((x + halfX) * GRID) - 1);
    const r0 = Math.max(0, Math.floor((y - halfY) * GRID)), r1 = Math.min(GRID - 1, Math.ceil((y + halfY) * GRID) - 1);
    let total = 0, filled = 0;
    for (let row = r0; row <= r1; row++) for (let column = c0; column <= c1; column++) { total++; if (!blank.has(row * GRID + column)) filled++; }
    return total ? filled / total : 0;
  };
  for (const need of [.75, .5]) {
    const options: { x: number; y: number }[] = [];
    for (let row = 2; row <= 7; row++) for (let column = 2; column <= 7; column++) {
      const point = { x: (column + .5) / GRID, y: (row + .5) / GRID };
      if (covered(point.x, point.y) >= need) options.push(point);
    }
    if (options.length) return options[hash(`${seed}|${artifactId.toLowerCase()}|v5`) % options.length];
  }
  return null;
}

export function locatorCorrect(seed: string, answer: LocatorAnswer): boolean {
  const target = locatorTarget(seed, answer.artifactId);
  const halfSize = Math.floor(Math.min(answer.imageWidth, answer.imageHeight) / 5) / 2;
  return Math.abs(answer.x - target.x) <= halfSize / answer.imageWidth + 1e-9
    && Math.abs(answer.y - target.y) <= halfSize / answer.imageHeight + 1e-9;
}

export function validLocatorAnswer(value: unknown): value is LocatorAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as LocatorAnswer;
  return typeof answer.artifactId === 'string' && Number.isFinite(answer.x) && Number.isFinite(answer.y)
    && answer.x >= 0 && answer.x <= 1 && answer.y >= 0 && answer.y <= 1
    && Number.isInteger(answer.imageWidth) && answer.imageWidth > 0 && answer.imageWidth <= 100000
    && Number.isInteger(answer.imageHeight) && answer.imageHeight > 0 && answer.imageHeight <= 100000
    && [answer.targetX, answer.targetY].every(coordinate => coordinate === undefined || (Number.isFinite(coordinate) && coordinate >= .15 && coordinate <= .85));
}
