import { KeyScopeType } from '../models/key-model';

// 會員、圖鑑與背包共用資產對照；分類鑰匙依分類代碼或名稱選用材質圖示。
const categoryAssets = [
  ['BRONZE', 'bronze', '青銅', '銅器'],
  ['CARVING', 'carving', '雕刻', '石質'],
  ['CERAMIC', 'ceramic', '陶瓷', '瓷器'],
  ['COIN', 'coin', '錢幣'],
  ['ENAMEL', 'enamel', '琺瑯'],
  ['JADE', 'jade', '玉器'],
  ['LACQUER', 'lacquer', '漆器'],
  ['PAINTING', 'painting', '書畫', '繪畫'],
] as const;

export function keyAssetPath(scopeType: KeyScopeType, category?: string | null): string {
  switch (scopeType) {
    case 'CATEGORY': {
      const value = category?.toUpperCase() ?? '';
      const asset = categoryAssets.find(([code, , ...labels]) =>
        new RegExp(`(^|[^A-Z])${code}($|[^A-Z])`).test(value) ||
        labels.some((label) => value.includes(label)),
      );
      if (asset) return `/assets/catalog/keys/category-${asset[1]}.png`;
      return '/assets/catalog/keys/category.png';
    }
    case 'ERA':
      return '/assets/catalog/keys/era.png';
    case 'UNIVERSAL':
      return '/assets/catalog/keys/universal.png';
    case 'NORMAL':
    default:
      return '/assets/catalog/keys/key-normal.svg';
  }
}
