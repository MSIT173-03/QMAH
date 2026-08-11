# 參考資料庫內容概況

GitHub Release 的 `QMAH-reference-*.bak` 是全組共同的開發起點。還原後會得到 5 個 schema、40 張專案資料表、Identity、文物主資料，以及可直接測試列表、關聯與狀態畫面的開發情境資料

網站啟動時不會自動建表、重設資料或執行 Seed。每位開發成員可在本機 LocalDB 新增、修改與刪除測試資料，不會影響其他資料庫副本

## 五個 schema

| Schema | 主要內容 | 目前資料概況 |
| --- | --- | --- |
| `catalog` | 文物、分類、年代、鑰匙、解鎖 | 8 類、13 個年代桶、256 件文物與少量鑰匙情境 |
| `game` | 題庫設定、房間、玩家、回合、作答、投票 | 256 筆題庫設定與一組可追查的遊戲流程 |
| `social` | 貼文、留言、檢舉、公告、活動、報名、通知 | 49 筆貼文、49 筆留言與各一筆管理情境 |
| `store` | 商品、購物車、優惠券、訂單、付款、點數 | 256 件商品與 3 組訂單／付款狀態 |
| `user` | Identity、Profile、地址、成就 | 8 個帳號、2 個角色、8 筆 Profile 與少量會員情境 |

## 各資料表筆數

以下筆數來自目前 Release 參考資料庫。`dbo.sysdiagrams` 是 SSMS 自己使用的系統表，不列入 40 張專案資料表

### Catalog

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactCategories` | 8 | 正式文物分類 |
| `EraBuckets` | 13 | 可供篩選與出題的年代區間 |
| `Artifacts` | 256 | 文物主資料、尺寸、圖片、來源與授權 |
| `KeyDefinitions` | 1 | 鑰匙規則情境 |
| `UserKeyBalances` | 1 | 會員鑰匙餘額情境 |
| `KeyTransactions` | 1 | 鑰匙異動流水情境 |
| `ArtifactUnlocks` | 1 | 文物解鎖情境 |

### Game

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `ArtifactQuestionEntries` | 256 | 每件文物的題型、難度與啟用設定 |
| `GameRooms` | 2 | `WAITING`、`COMPLETED` 房間各一筆 |
| `GamePlayers` | 3 | 房間玩家 |
| `GameRounds` | 1 | 已建立的回合 |
| `RoundAnswers` | 2 | 玩家作答 |
| `Votes` | 1 | 玩家投票 |

### Social

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `SocialPosts` | 49 | 41 筆 `PUBLISHED`、4 筆 `HIDDEN`、4 筆 `DELETED` |
| `SocialComments` | 49 | 貼文留言與清單測試 |
| `ContentReports` | 1 | `PENDING` 檢舉 |
| `OfficialAnnouncements` | 1 | 官方公告 |
| `Events` | 1 | 活動 |
| `EventRegistrations` | 1 | 活動報名 |
| `UserNotifications` | 1 | 站內通知 |

### Store

| 資料表 | 筆數 | 用途 |
| --- | ---: | --- |
| `Products` | 256 | 與文物一對一的縮小複製品商品 |
| `CartItems` | 1 | 購物車情境 |
| `CouponDefinitions` | 1 | 優惠券定義 |
| `UserCoupons` | 1 | `AVAILABLE` 會員優惠券 |
| `StoreOrders` | 3 | `PENDING_PAYMENT`、`COMPLETED`、`CANCELLED` 各一筆 |
| `OrderDetails` | 3 | 成交品名與單價快照 |
| `Payments` | 3 | `PENDING`、`PAID`、`FAILED` 各一筆 |
| `PointBalances` | 1 | 會員點數餘額 |
| `PointTransactions` | 1 | 點數異動流水 |

### User 與 Identity

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

Identity 的 Claim、外部登入與 Token 維持空白是刻意的。這三張表由 Identity 在功能真正啟用時寫入，不需要為了讓每張表都有資料而建立無意義假資料

## 狀態與類型代碼

下列字串由 SQL Server CHECK constraint 限制，不是自由輸入欄位。Controller、ViewModel 與下拉選單必須使用相同代碼；中文只用於畫面顯示。

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

訂單使用 `PENDING_PAYMENT`，因為訂單後續還可能等待備貨或出貨，狀態名稱需要指出目前等待付款。付款紀錄本身位於 `Payments`，`PENDING` 已能表示該筆交易尚未取得結果，不再重複加入 `PAYMENT`。

## 256 件文物如何共用

`catalog.Artifacts` 是主資料。題庫與商城分別以外鍵連回同一個 `ArtifactId`

```text
catalog.Artifacts.Id
  ├─ game.ArtifactQuestionEntries.ArtifactId
  └─ store.Products.ArtifactId
```

三邊共用同一張 Open Data 文物圖片，不重複保存圖片檔。題庫另外保存難度與啟用狀態；商品另外保存名稱、文案、換算尺寸、售價、庫存與上架狀態

商品或題庫日後可以獨立停用。已成立的訂單、回合、作答與投票屬於歷史資料，不會因文物或商品下架而刪除

## 哪些資料可以自行修改

在本機 LocalDB 測試 CRUD 時，可新增商品、房間、貼文、訂單、會員 Profile 或其他情境資料。資料必須符合既有外鍵、唯一索引與 CHECK constraint；只有 Schema 變更需要進入共同變更流程

只有要改資料表、欄位、型別、是否允許 `NULL`、索引、外鍵、CHECK constraint 或跨 Area 關係時，才需要先走 Schema 整合流程

資料怎麼查、怎麼新增，以及不同 Area 應使用哪些 DbSet，請看[QmahDbContext 使用手冊](dbcontext-usage.md)。資料來源與更新流程請看[QMAH 資料工具](../tools/QmahDataTools/README.md)
