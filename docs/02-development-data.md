# 開發資料與參考資料庫

QMAH 只有一份共同資料庫設計。每位成員在本機還原自己的 `QMAH` 資料庫副本，使用相同 Schema 與共同基準資料；本機新增、修改或刪除的測試資料不會影響其他副本。

## 1. 取得共同資料

先到 GitHub Repository 頁面的 **Releases** 開啟最新版本，在 **Assets** 下載 `QMAH-reference-*.bak`。資料庫還原步驟請看 [`database/README.md`](../database/README.md)。

還原後可以直接用 Visual Studio 啟動網站。網站啟動時不會建表、重設資料、執行 Seed 或覆寫本機資料。

共同備份包含：

- SQL Server Schema、索引、外鍵與 CHECK constraint
- 256 件文物、256 筆題庫設定與 256 件對應商城商品
- 各 Area 用於清單、詳情、關聯與狀態畫面的代表性測試資料
- Identity 帳號、角色與會員資料

## 2. 目前參考資料庫內容

以下數量以目前 Release 參考 `.bak` 為準。`dbo.sysdiagrams` 是 SSMS 使用的系統表，不列入 QMAH 業務資料表數量。

### 2.1 五個 Schema

| Schema | 主要內容 | 目前資料概況 |
| --- | --- | --- |
| `catalog` | 文物、分類、年代、鑰匙、解鎖 | 8 類、13 個年代桶、256 件文物與鑰匙情境 |
| `game` | 題庫設定、房間、玩家、回合、作答、投票 | 256 筆題庫設定、10 個房間、19 位玩家與一組完整遊戲流程 |
| `social` | 貼文、留言、檢舉、公告、活動、報名、通知 | 49 筆貼文、49 筆留言與管理情境 |
| `store` | 商品、購物車、優惠券、訂單、付款、點數 | 256 件商品與 12 組訂單／付款紀錄 |
| `user` | Identity、Profile、地址、成就 | 8 個帳號、2 個角色、8 筆 Profile 與會員情境 |

### 2.2 Catalog

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactCategories` | 8 | 正式文物分類 |
| `EraBuckets` | 13 | 篩選與出題使用的年代區間 |
| `Artifacts` | 256 | 文物主資料、尺寸、圖片、來源與授權 |
| `KeyDefinitions` | 1 | 鑰匙規則情境 |
| `UserKeyBalances` | 1 | 會員鑰匙餘額情境 |
| `KeyTransactions` | 1 | 鑰匙異動流水情境 |
| `ArtifactUnlocks` | 1 | 文物解鎖情境 |

### 2.3 Game

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactQuestionEntries` | 256 | 每件文物的題型、難度與啟用設定 |
| `GameRooms` | 10 | 3 筆 `WAITING`、2 筆 `PLAYING`、3 筆 `COMPLETED`、2 筆 `CANCELLED` |
| `GamePlayers` | 19 | 8 位 `ONLINE`、1 位 `OFFLINE`、10 位 `LEFT`，可測試玩家與連線狀態清單 |
| `GameRounds` | 1 | 已建立的回合 |
| `RoundAnswers` | 2 | 玩家作答 |
| `Votes` | 1 | 玩家投票 |

### 2.4 Social

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `SocialPosts` | 49 | 41 筆 `PUBLISHED`、4 筆 `HIDDEN`、4 筆 `DELETED` |
| `SocialComments` | 49 | 貼文留言與清單測試 |
| `ContentReports` | 1 | `PENDING` 檢舉 |
| `OfficialAnnouncements` | 1 | 官方公告 |
| `Events` | 1 | 活動 |
| `EventRegistrations` | 1 | 活動報名 |
| `UserNotifications` | 1 | 站內通知 |

### 2.5 Store

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `Products` | 256 | 與文物一對一的縮小複製品商品 |
| `CartItems` | 1 | 購物車情境 |
| `CouponDefinitions` | 1 | 優惠券定義 |
| `UserCoupons` | 1 | `AVAILABLE` 會員優惠券 |
| `StoreOrders` | 12 | 六種訂單狀態各 2 筆，可測試付款、備貨、出貨、完成與取消清單 |
| `OrderDetails` | 12 | 每張訂單各一筆成交品名、單價與數量快照 |
| `Payments` | 12 | 2 筆 `PENDING`、8 筆 `PAID`、2 筆 `FAILED` |
| `PointBalances` | 1 | 會員點數餘額 |
| `PointTransactions` | 1 | 點數異動流水 |

### 2.6 User 與 Identity

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `AspNetUsers` | 8 | Identity 帳號 |
| `AspNetRoles` | 2 | `Admin`、`User` |
| `AspNetUserRoles` | 8 | 帳號與角色對應 |
| `UserProfiles` | 8 | 暱稱與會員公開資料 |
| `UserAddresses` | 1 | 地址情境 |
| `Achievements` | 1 | 成就定義 |
| `UserAchievements` | 1 | 會員取得成就情境 |
| `AspNetRoleClaims` | 0 | 尚未建立角色 Claim |
| `AspNetUserClaims` | 0 | 尚未建立會員 Claim |
| `AspNetUserLogins` | 0 | 第三方登入尚未啟用 |
| `AspNetUserTokens` | 0 | 尚未產生持久 Token |

Claim、外部登入與 Token 維持空白是刻意的。這三張表由 Identity 在功能真正啟用時寫入，不需要為了讓每張表都有資料而建立假資料。

## 3. 文物、題庫與商城商品的關係

`catalog.Artifacts` 是文物主資料。題庫與商城都以外鍵 `ArtifactId` 對應同一件文物：

```text
catalog.Artifacts.Id
  ├─ game.ArtifactQuestionEntries.ArtifactId
  └─ store.Products.ArtifactId
```

三邊共用同一張 Open Data 文物圖片，不重複保存圖片檔。

- 題庫另外保存題型、難度與是否可出題
- 商品另外保存名稱、文案、換算尺寸、售價、庫存與上架狀態
- 商品或題庫可以獨立停用
- 已成立的訂單、回合、作答與投票屬於歷史資料，不因文物或商品下架而刪除

## 4. 狀態與類型代碼

下列值由 SQL Server CHECK constraint 限制，不是自由輸入文字。Controller、ViewModel 與下拉選單使用相同代碼，中文只用於畫面顯示。

| 範圍 | 欄位 | 合法值 |
| --- | --- | --- |
| Catalog | `KeyDefinitions.ScopeType` | `NORMAL`（一般）、`CATEGORY`（分類）、`ERA`（年代）、`UNIVERSAL`（通用） |
| Game | `GamePlayers.ConnectionStatus` | `ONLINE`（在線）、`OFFLINE`（暫時離線）、`LEFT`（已離開） |
| Game | `GameRooms.Status` | `WAITING`（等待中）、`PLAYING`（進行中）、`COMPLETED`（已完成）、`CANCELLED`（已取消） |
| Game | `GameRounds.Status` | `ANSWERING`（作答中）、`VOTING`（投票中）、`REVEALED`（已揭曉） |
| Game | `RoundAnswers.AnswerType` | `FACTUAL_REASONING`（事實推理）、`PLAUSIBLE_FICTION`（合理虛構）、`CREATIVE_TALE`（創意故事） |
| Social | `SocialPosts.Status`、`SocialComments.Status` | `PUBLISHED`（已發布）、`HIDDEN`（已隱藏）、`DELETED`（已刪除） |
| Social | `ContentReports.Status` | `PENDING`（待處理）、`RESOLVED`（已處理）、`REJECTED`（不成立） |
| Social | `ContentReports.TargetType` | `POST`（貼文）、`COMMENT`（留言） |
| Social | `Events.EventType` | `OFFICIAL`（官方活動）、`PLAYER`（玩家活動） |
| Social | `Events.ReviewStatus` | `PENDING`（待審核）、`APPROVED`（已通過）、`REJECTED`（未通過） |
| Social | `Events.PublishStatus` | `DRAFT`（草稿）、`PUBLISHED`（已發布）、`CANCELLED`（已取消） |
| Social | `EventRegistrations.Status` | `REGISTERED`（已報名）、`ATTENDED`（已出席）、`CANCELLED`（已取消） |
| Social | `OfficialAnnouncements.Status` | `DRAFT`（草稿）、`PUBLISHED`（已發布）、`ARCHIVED`（已封存） |
| Store | `StoreOrders.Status` | `PENDING_PAYMENT`（待付款）、`PAID`（已付款）、`FULFILLING`（備貨中）、`SHIPPED`（已出貨）、`COMPLETED`（已完成）、`CANCELLED`（已取消） |
| Store | `Payments.Status` | `PENDING`（處理中）、`PAID`（付款成功）、`FAILED`（付款失敗）、`CANCELLED`（已取消） |
| Store | `CouponDefinitions.DiscountType` | `PERCENT`（百分比折扣）、`FIXED`（固定金額折抵） |
| Store | `UserCoupons.Status` | `AVAILABLE`（可使用）、`USED`（已使用）、`EXPIRED`（已過期） |
| User | `AspNetUsers.Status` | `ACTIVE`（正常）、`DISABLED`（停用）、`BANNED`（停權） |
| User | `Achievements.Status` | `ACTIVE`（啟用）、`INACTIVE`（停用） |

訂單使用 `PENDING_PAYMENT`，因為訂單後續還會進入備貨、出貨等階段；付款紀錄位於 `Payments`，`PENDING` 已能表示該筆交易尚未取得結果。

## 5. 可以直接建立的本機測試資料

以下資料可以在自己的 LocalDB 建立、修改與刪除：

- Game：房間、玩家、回合、作答、投票
- Social：貼文、留言、公告、活動、報名、通知、檢舉
- Store：購物車、折價券、訂單、付款、點數
- User：Profile、地址、通知、成就
- Catalog：分類管理頁需要的測試分類、鑰匙與解鎖紀錄

測試資料仍須符合既有外鍵、唯一索引與 CHECK constraint。各副本的資料列不必相同；共同契約是 Schema。

共同資料已涵蓋所有房間狀態、所有訂單狀態，以及付款的 `PENDING`、`PAID`、`FAILED`。個人開發仍可在自己的 LocalDB 增加資料，但不需要為了測試基本清單與篩選重新準備這些狀態。

若資料庫已有正式文物與 Identity 資料，但缺少共同展示情境，可執行 [`database/seed-showcase-data.sql`](../database/seed-showcase-data.sql)。腳本會補入社群貼文與留言、遊戲房間與玩家、商城訂單與付款，不會改 Schema，也不會由網站啟動流程自動執行。各區段都有防重複條件，可安全地再次執行。

## 6. 訂單與付款規則

一張訂單只對應一筆付款紀錄，`Payments.OrderId` 有唯一限制。付款失敗或取消時，訂單改成 `CANCELLED`；使用者要再買一次，就建立新的訂單與新的付款紀錄。

這個規則讓訂單、付款與後台列表容易判讀，也符合目前專題不處理同一張訂單多次付款重試的範圍。

## 7. 什麼時候需要提出 Schema 變更

下列變更需要先提交資料庫結構變更說明：

- 新增、刪除或改名資料表、欄位
- 修改資料型別、`NULL`、預設值或 CHECK constraint
- 新增或修改外鍵、唯一索引或一般索引
- 改變跨 Area 的資料關係或歷史資料保存方式

只是在自己的 LocalDB 多建立幾筆商品、訂單、貼文或會員資料，不需要提出。

## 8. 共同資料的存取方式

```text
單表 CRUD：Controller → QmahDbContext → SQL Server
跨表交易、長流程、外部服務、重複呼叫或獨立測試：Controller → Service → QmahDbContext → SQL Server
登入與角色：Controller → Identity API → SQL Server
```

不採用「每張表一個 Wrapper」、Generic Repository 或「每張表一個 Service」。只有外層確實需要集中保護不可繞過的行為，或需要轉接不能修改的第三方物件時，才建立特定 Wrapper；一般 EF Core CRUD 直接使用 Entity 與 `QmahDbContext`。

## 9. 更新共同基準

```text
資料工具整理與驗證
  → SQL Server 共同資料庫
  → Entity、QmahDbContext、Schema.sql 一致性檢查
  → 輸出新的參考 .bak
  → 上傳 GitHub Release 的 Assets
```

工具輸出的原始檔、快取與品質報告只放在工作區 `_工具輸出`。Repository 不保存 `.bak`、本機資料庫或 raw output。
