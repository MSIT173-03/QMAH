export interface LocatorAnswer { artifactId: string; x: number; y: number; imageWidth: number; imageHeight: number; }

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
    && Number.isInteger(answer.imageHeight) && answer.imageHeight > 0 && answer.imageHeight <= 100000;
}
