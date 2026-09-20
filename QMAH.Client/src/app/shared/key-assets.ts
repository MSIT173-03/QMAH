import { KeyScopeType } from '../models/key-model';

// ui-integration: 四種內容型鑰匙共用同一個部署資產對照，讓會員、圖鑑與背包不會各自指向不同圖檔。
export function keyAssetPath(scopeType: KeyScopeType): string {
  switch (scopeType) {
    case 'CATEGORY':
      return '/assets/catalog/keys/category.png';
    case 'ERA':
      return '/assets/catalog/keys/era.png';
    case 'UNIVERSAL':
      return '/assets/catalog/keys/universal.png';
    case 'NORMAL':
    default:
      return '/assets/catalog/keys/normal.png';
  }
}
