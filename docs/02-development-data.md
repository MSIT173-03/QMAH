# 開發資料與參考資料庫

QMAH 只有一份共同資料庫設計。每位成員在本機還原自己的 `QMAH` 資料庫副本，使用相同 Schema 與共同基準資料；本機新增、修改或刪除的測試資料不會影響其他副本。

## 1. 取得共同資料

先到 GitHub Repository 頁面的 **Releases** 開啟最新版本，在 **Assets** 下載 `QMAH-<version>.bak` 並用 SSMS 還原；也可以直接在 SSMS 執行 Repository 的 [`database/QMAH.sql`](../database/QMAH.sql)，或執行 Release 附帶的同版本 `.sql`。兩種方式擇一即可，資料庫還原步驟請看 [`database/README.md`](../database/README.md)。

完成其中一種方式後即可直接用 Visual Studio 啟動網站。網站啟動時不會建表、重設資料、執行 Seed 或覆寫本機資料。

共同備份包含：

- SQL Server Schema、索引、外鍵與 CHECK constraint
- 256 件文物、256 筆題庫設定與 256 件對應商城商品
- 各 Area 用於清單、詳情、關聯與狀態畫面的代表性測試資料
- Identity 帳號、角色與會員資料；後台稽核與社群媒體資料表結構

## 2. Release 共同資料內容

以下數量以目前共同 Release `.bak`／`.sql` 同源的完整資料庫快照為準。這就是每位組員還原後取得的共同資料，已包含社群、商城、遊戲與營運頁面需要的展示情境，不需要再執行任何增量資料工具。`generate-showcase-data` 仍可由資料庫整合者在建立下一份快照前，或由個人在隔離資料庫中重建資料；它的批次參數不代表另一個 Release，也不代表組員還原後要再補上的數量。`dbo.sysdiagrams` 是 SSMS 使用的系統表，不列入 QMAH 業務資料表數量。

### 2.1 共用 Schema

| Schema | 主要內容 | 目前資料概況 |
| --- | --- | --- |
| `admin` | 後台稽核操作 | 目前 1 筆；網站執行後由後台操作持續累積 |
| `catalog` | 文物、分類、年代、鑰匙、解鎖 | 8 類、12 個年代桶、256 件文物、23 筆鑰匙規則與相關流水 |
| `game` | 題庫設定、房間、玩家、回合、作答、投票 | 256 筆題庫設定、8 個房間、16 筆玩家紀錄與 20 個回合 |
| `social` | 貼文（含官方公告類型）、留言、檢舉、活動、報名、通知、社群媒體 | 336 篇貼文、768 筆留言、3 筆檢舉、7 個活動與 5 筆報名；圖片依實際上傳累積 |
| `store` | 商品、購物車、優惠券、訂單、付款、點數 | 256 件商品、208 組訂單／付款紀錄、12 張優惠券與 96 筆商品評價 |
| `user` | Identity、Profile、地址、成就 | 24 個帳號、2 個角色、24 筆 Profile 與會員情境 |

### 2.2 Catalog

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactCategories` | 8 | 正式文物分類 |
| `EraBuckets` | 12 | 篩選與出題使用的年代區間 |
| `Artifacts` | 256 | 文物主資料、尺寸、圖片、來源與授權 |
| `KeyDefinitions` | 23 | 鑰匙規則與作用範圍 |
| `UserKeyBalances` | 49 | 會員鑰匙餘額情境 |
| `KeyTransactions` | 49 | 鑰匙異動流水情境 |
| `ArtifactUnlocks` | 0 | 尚未建立解鎖紀錄；功能啟用後由實際行為產生 |

### 2.3 Game

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactQuestionEntries` | 256 | 每件文物的題型、難度與啟用設定 |
| `GameRooms` | 8 | `WAITING`、`PLAYING`、`COMPLETED`、`CANCELLED` 各 2 筆 |
| `GamePlayers` | 16 | 7 位 `ONLINE`、1 位 `OFFLINE`、8 位 `LEFT`，可測試玩家與連線狀態清單 |
| `GameRounds` | 20 | 1 個 `ANSWERING`、1 個 `VOTING`、18 個 `REVEALED` 回合 |
| `RoundAnswers` | 36 | 不同回合與玩家的作答內容 |
| `Votes` | 36 | 玩家對作答的投票紀錄 |

### 2.4 Social

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `SocialPosts` | 336 | 320 筆 `PUBLISHED`、10 筆 `HIDDEN`、6 筆 `DELETED` |
| `SocialComments` | 768 | 不同貼文的主留言與回覆，保留父子討論脈絡 |
| `ContentReports` | 3 | 2 筆 `PENDING` 與 1 筆 `RESOLVED` 檢舉 |
| `OfficialAnnouncements` | 0 | 新公告使用 `SocialPosts` 的公告貼文類型；舊表僅保留結構相容性 |
| `Events` | 7 | 涵蓋待審核、已通過、未通過、草稿、已發布與已取消情境 |
| `EventRegistrations` | 5 | 不同活動的報名與出席情境 |
| `UserNotifications` | 0 | 尚未建立通知；功能啟用後由實際事件產生 |
| `MediaAssets` | 0 起 | 社群上傳圖片的中繼資料；官方文物圖鑑圖片不列入此表 |

### 2.5 Admin

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `AuditLogs` | 1 筆起，由後台操作累積 | 管理操作的時間、操作者、目標與結果；不保存密碼、Cookie、Token 或 request body |

### 2.6 Store

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `Products` | 256 | 與文物一對一的縮小複製品商品 |
| `ProductReviews` | 96 | 88 筆 `PUBLISHED`、5 筆 `HIDDEN`、3 筆 `DELETED`；公開摘要只計入已發布評價 |
| `CartItems` | 0 | 尚未建立購物車內容；功能啟用後由會員操作產生 |
| `CouponDefinitions` | 12 | 優惠券定義 |
| `UserCoupons` | 9 | 會員可用、已使用與已過期優惠券情境 |
| `StoreOrders` | 208 | 涵蓋六種訂單狀態：30 筆取消、38 筆完成、35 筆備貨、39 筆已付款、31 筆待付款、35 筆已出貨 |
| `OrderDetails` | 298 | 多商品訂單的成交品名、單價與數量快照 |
| `Payments` | 208 | 31 筆 `PENDING`、147 筆 `PAID`、30 筆 `FAILED` |
| `PointBalances` | 5 | 會員點數餘額 |
| `PointTransactions` | 8 | 點數異動流水 |

### 2.7 User 與 Identity

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `AspNetUsers` | 24 | 8 個主要情境帳號與 16 個展示會員 |
| `AspNetRoles` | 2 | `Admin`、`User` |
| `AspNetUserRoles` | 24 | 帳號與角色對應 |
| `UserProfiles` | 24 | 每個展示帳號都有自然的暱稱、簡介與公開範圍 |
| `UserAddresses` | 3 | 不同收件用途的地址情境；不使用真實個資 |
| `Achievements` | 12 | 展示成就 |
| `UserAchievements` | 10 | 會員取得成就情境 |
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
| Social | `OfficialAnnouncements.Status` | `DRAFT`（草稿）、`PUBLISHED`（已發布）、`ARCHIVED`（已封存；僅相容舊資料） |
| Store | `StoreOrders.Status` | `PENDING_PAYMENT`（待付款）、`PAID`（已付款）、`FULFILLING`（備貨中）、`SHIPPED`（已出貨）、`COMPLETED`（已完成）、`CANCELLED`（已取消） |
| Store | `Payments.Status` | `PENDING`（處理中）、`PAID`（付款成功）、`FAILED`（付款失敗）、`CANCELLED`（已取消） |
| Store | `CouponDefinitions.DiscountType` | `PERCENT`（百分比折扣）、`FIXED`（固定金額折抵） |
| Store | `UserCoupons.Status` | `AVAILABLE`（可使用）、`USED`（已使用）、`EXPIRED`（已過期） |
| User | `AspNetUsers.Status` | `ACTIVE`（正常）、`DISABLED`（停用）、`BANNED`（停權） |
| User | `Achievements.Status` | `ACTIVE`（啟用）、`INACTIVE`（停用） |

訂單使用 `PENDING_PAYMENT`，因為訂單後續還會進入備貨、出貨等階段；付款紀錄位於 `Payments`，`PENDING` 已能表示該筆交易尚未取得結果。

## 5. 資料工具（只供維護完整快照或個人資料庫使用）

一般組員不需要執行本節。還原最新 Release 的單一 `.bak`，或執行同源的完整 `database/QMAH.sql` 後，已經包含本文件前段列出的完整共同資料，可以直接開始開發；本節的命令只由資料庫整合者在產生下一份完整 snapshot 前使用，或供個人在隔離資料庫中重建展示情境。

以下資料可以在自己的 LocalDB 建立、修改與刪除：

- Game：房間、玩家、回合、作答、投票
- Social：貼文、留言、公告貼文、活動、報名、通知、檢舉、社群媒體
- Store：購物車、折價券、訂單、付款、點數
- User：Profile、地址、通知、成就
- Catalog：分類管理頁需要的測試分類、鑰匙與解鎖紀錄

測試資料仍須符合既有外鍵、唯一索引與 CHECK constraint。各副本的資料列不必相同；共同契約是 Schema。

共同資料已涵蓋所有房間狀態、所有訂單狀態，以及付款的 `PENDING`、`PAID`、`FAILED`。個人開發仍可在自己的 LocalDB 增加資料，但不需要為了測試基本清單與篩選重新準備這些狀態。

資料庫整合者若要重建下一份完整 snapshot，先在隔離的 canonical database 使用 `QmahDatabaseRelease seed-showcase-users` 建立或更新 24 個展示帳號，再使用資料工具產生與文物、商品及會員互相連結的內容。完成後必須重新執行 `Export-ReferenceDatabase.ps1`，讓產物回到單一完整 `.bak`／`.sql`；不可把這些命令列為組員還原後的步驟：

```powershell
dotnet run --project .\tools\QmahDataTools\QmahDatabaseRelease\QmahDatabaseRelease.csproj -- `
  generate-showcase-data `
  --connection "Server=(localdb)\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False" `
  --post-count 288 `
  --order-count 160 `
  --seed 173
```

工具預設會在隔離資料庫產生一批 288 篇不同主題的貼文：約 96 篇文物專題、41 篇鑑定遊戲交流、112 篇一般社群內容、7 篇由實際活動資料建立的活動貼文，以及 32 篇官方公告。每篇貼文至少有兩筆留言，每三篇再增加一筆回覆，共 672 筆展示留言；另有 160 筆只使用文物縮小複製品的訂單與 96 筆商品評價。文物專題只取部分文物，遊戲貼文也只有部分回合會連到文物，因此不會讓 256 件文物看起來全部都被安排過討論。社群文章依固定順序取用獨立素材，不以亂數拼接句子或循環重用相同文章；文章、文物、活動、商品與會員關係仍由實際外鍵維持。`--post-count`、`--order-count` 與 `--seed` 可以在維護者或個人資料庫調整；相同參數會更新同一批工具資料，不會任意產生重複資料。這些數字是工具批次數量，最後快照的總數以本節前段的實際資料表統計為準；命令不建立 Schema、不執行 Migration，也不刪除非工具產生的資料。

資料庫整合者若要在隔離資料庫補齊活動、檢舉、成就、優惠券及會員管理情境，才執行 [`database/seed-admin-showcase-data.sql`](../database/seed-admin-showcase-data.sql)。原本的 [`database/seed-showcase-data.sql`](../database/seed-showcase-data.sql) 保留為固定 SQL 的相容性補充；使用資料工具建立豐富展示資料時，不需要再執行它，避免同一批本機內容重複增加。一般組員還原完整快照後不需要執行這兩份腳本。

PowerShell 或 SSMS 以 UTF-8 執行腳本時，建議使用：

```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -d QMAH -E -f 65001 -b -r1 -i .\database\seed-admin-showcase-data.sql
```

目前 Release 的 `.bak` 與 `database/QMAH.sql` 已包含 256 件文物、題庫、商品，以及本文件前段列出的社群、商城、遊戲與營運展示資料。展示資料工具與相容性腳本只用於維護者產生下一份完整快照或個人隔離資料庫，不是組員還原後的增量步驟，也不是文物匯入工具的替代品。

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
  → 同一次輸出新的 `database/QMAH.sql`、Release `.sql` 與 `.bak`
  → 上傳 GitHub Release 的 Assets
```

工具輸出的原始檔、快取與品質報告只放在工作區 `_工具輸出`。Repository 不保存 `.bak`、本機資料庫或 raw output。
