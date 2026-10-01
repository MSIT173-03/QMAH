// era-initials.ts
/**
 * 年代鑰匙的背景字：字首不重複就用一個字；
 * 字首重複時，取字首＋第一個跟同字首年代不重複的字。
 *
 * 例：唐 → 唐、日本大正時代 → 日大、日本江戶時代 → 日江、中華民國 → 中民。
 * 傳入「所有年代名稱」一起算，才知道哪些字首重複；新增年代後結果會自動跟著變。
 */
export function eraInitials(names: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const name of new Set(names)) {
    if (!name) continue;
    const first = [...name][0];
    groups.set(first, [...(groups.get(first) ?? []), name]);
  }

  for (const group of groups.values()) {
    for (const name of group) {
      const chars = [...name];
      if (group.length === 1) {
        result.set(name, chars[0]);
        continue;
      }
      const others = group.filter((other) => other !== name).map((other) => [...other]);
      const index = chars.findIndex((char, i) => i > 0 && others.every((other) => other[i] !== char));
      result.set(name, chars[0] + (index > 0 ? chars[index] : chars[1] ?? ''));
    }
  }
  return result;
}
