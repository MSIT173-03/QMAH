import { ERA_FALLBACK } from '../../artifact-list/artifact-list';

/** 器類名稱對應的色調名稱：分類入口卡片與商品卡片的器類角標共用，同一個器類在全站同一個顏色。 */
export function categoryTone(name: string): string {
  if (/漆/.test(name)) return 'cinnabar';
  if (/陶|瓷|磚|瓦/.test(name)) return 'celadon';
  if (/玉/.test(name)) return 'jade';
  if (/琺瑯/.test(name)) return 'rouge';
  if (/畫|書|紙|帖|絹|織|繡/.test(name)) return 'indigo';
  if (/幣/.test(name)) return 'bronze';
  if (/銅|金|銀|錫|鐵/.test(name)) return 'ochre';
  return 'slate';
}

/** 年代色與圖鑑相同：依年代起始年分成九個顏料色，日本各時代用藤紫。 */
export function eraTone(name: string): string {
  if (name.startsWith('日本')) return 'plum';
  const start = ERA_FALLBACK.find((era) => era.name === name)?.start;
  if (start == null) return 'stone';
  if (start < -2000) return 'slate';
  if (start < -475) return 'bronze';
  if (start < 220) return 'cinnabar';
  if (start < 618) return 'ochre';
  if (start < 907) return 'jade';
  if (start < 1271) return 'celadon';
  if (start < 1644) return 'indigo';
  if (start < 1868) return 'rouge';
  return 'sumi';
}
