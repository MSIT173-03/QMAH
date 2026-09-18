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

/**
 * 對應 GET /me/keys/exchange-rules 的其中一筆規則：某種鑰匙（scopeType）
 * 解鎖一次要消耗幾把（costPerUnlock）。
 *
 * ⚠️ 目前沒有實際回應可以對照，這是依「不同鑰匙解鎖一次可能要消耗不同數量」
 * 這個需求反推出來的猜測形狀。KeyService.getExchangeRules() 在解析每一筆時
 * 也多猜了幾個常見欄位名稱（cost／requiredCount／keyCost）當備援，等你把
 * 實際回應貼給我，我再把型別和解析邏輯一起對齊、拿掉備援猜測。
 */
export interface KeyExchangeRule {
  scopeType: KeyScopeType;
  costPerUnlock: number;
}

/**
 * 依 scopeType 從規則清單找出對應的解鎖成本。
 * 找不到（規則還沒載入完成、或後端沒有回傳這個 scopeType 的規則）時 fallback 為 1，
 * 避免畫面在規則載入完成前，因為算不出成本而整個卡住或誤判「數量不足」。
 */
export function costForScope(rules: KeyExchangeRule[], scopeType: KeyScopeType): number {
  return rules.find((rule) => rule.scopeType === scopeType)?.costPerUnlock ?? 1;
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
