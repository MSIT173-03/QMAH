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

/** 對應 GET /me/keys/exchange-rules 的實際回應：來源鑰匙換成目標鑰匙。 */
export interface KeyExchangeRule {
  id: string;
  sourceKeyCode: string;
  sourceKeyName: string;
  sourceAmount: number;
  targetKeyCode: string;
  targetKeyName: string;
  targetAmount: number;
  targetEligibleArtifactCount: number;
  description: string | null;
}

/** 對應 POST /me/keys/exchange 的完成結果。 */
export interface KeyExchangeResult {
  ruleId: string;
  sourceKeyCode: string;
  sourceAmount: number;
  targetKeyCode: string;
  targetAmount: number;
  targetEligibleArtifactCount: number;
}

/**
 * POST /api/v1/me/keys/{keyCode}/unlock 的請求 body。
 * 一般／年代／分類鑰匙：後端依鑰匙特性隨機挑一個尚未解鎖、且符合條件（同年代／同分類）
 * 的文物，隨機挑選、避免重複解鎖的邏輯由後端負責。
 * 萬能鑰匙：指定玩家在圖鑑頁選中的那個文物。
 *
 * ⚠️ artifactId 改成「一定要有這個 key，但值可以是 null」，不是原本的「可以整個省略」：
 * 實測發現一般／分類／年代鑰匙不帶 artifactId、送出 {} 時，後端回傳的 400 是
 * ASP.NET Core 反序列化階段就失敗的通用格式（沒有 errors 欄位），很像後端的
 * request DTO 把 ArtifactId 宣告成 C# 的 required 屬性（型別可為 Guid?，但屬性本身
 * 一定要出現在 JSON 裡）。改成永遠帶著這個欄位、沒有指定文物時送 null，
 * 讓後端「這個屬性存在但是 null」時走隨機挑選的邏輯。
 */
export interface UnlockWithKeyRequest {
  artifactId: string | null;
}

/**
 * POST /api/v1/me/keys/{keyCode}/unlock 的回應。
 *
 * ⚠️ 已依後端 EconomyService.UnlockArtifactAsync() 實際回傳的 ArtifactUnlockView
 * 修正：欄位順序是 unlocked, artifactId, artifactName, remainingEligibleArtifactCount, message。
 * artifactId／artifactName 是可為 null 的——當這把鑰匙目前沒有符合條件的未解鎖文物時，
 * 後端會回 HTTP 200 + unlocked: false + artifactId/artifactName 皆為 null + message
 * 說明原因（不會扣鑰匙），不是回傳錯誤狀態碼。呼叫端务必檢查 result.unlocked，
 * 不能只看 HTTP 請求有沒有成功就當作真的解鎖了。
 */
export interface UnlockWithKeyResult {
  unlocked: boolean;
  artifactId: string | null;
  artifactName: string | null;
  remainingEligibleArtifactCount: number;
  message: string | null;
}
