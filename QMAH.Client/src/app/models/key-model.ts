// key-model.ts

/** 對應鑰匙的適用範圍：一般／分類限定／年代限定／萬能 */
export type KeyScopeType = 'NORMAL' | 'CATEGORY' | 'ERA' | 'UNIVERSAL';

export interface KeyModel {
  id: string;
  code: string;
  name: string;
  scopeType: KeyScopeType;
  categoryId: string | null;
  eraBucketId: string | null;
  balance: number;
  eligibleArtifactCount: number;
  recyclePointValue: number;
}

/** 篩選列用；'ALL' 是畫面上多出來的選項，不是後端資料本身會有的 scopeType */
export type KeyFilter = 'ALL' | KeyScopeType;
