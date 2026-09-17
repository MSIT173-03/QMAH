// key-model.ts
import { ArtifactUnlockRecord } from './artifact-unlock-model';

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

/**
 * POST /api/v1/me/keys/{keyCode}/unlock 的請求 body。
 * 一般／年代／分類鑰匙：不用帶 artifactId，後端依鑰匙特性隨機挑一個尚未解鎖、
 * 且符合條件（同年代／同分類）的文物，隨機挑選、避免重複解鎖的邏輯由後端負責。
 * 萬能鑰匙：要帶 artifactId，指定玩家在圖鑑頁選中的那個文物。
 */
export interface UnlockWithKeyRequest {
  artifactId?: string;
}

// ⚠️ 下面這個回應型別是照你給的端點路徑（POST /me/keys/{keyCode}/unlock）跟
// ArtifactUnlocks 資料表推出來的合理猜測，沒有實際對照過後端真正的回應 body。
// 等後端把這支端點做出來，把實際回應貼給我對一下欄位名稱／型別。
/** POST /api/v1/me/keys/{keyCode}/unlock 的回應：解鎖了哪個文物、流水紀錄、這把鑰匙剩餘數量 */
export interface UnlockWithKeyResult {
  artifactId: string;
  artifactName: string;
  record: ArtifactUnlockRecord;
  remainingBalance: number; // 這把鑰匙用掉一把之後剩下的數量
}
