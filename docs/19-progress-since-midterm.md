# 期中基準後的開發進度

本文件整理目前版本庫從 `v0.3.0`（`ed18ee0`，2026-08-13）之後到現階段的主要變化。這個 tag 是目前 Git 歷史中可以明確辨識的共同基準點，方便組員快速了解既有程式在這段期間增加了哪些能力。

## 專案結構與啟動方式

QMAH 從單一後台程式整理成共用資料層加上三個可獨立啟動的主機：

- `QMAH.Infrastructure` 集中 DB-first（以資料庫結構為準）的 Entity、`QmahDbContext`、媒體網址解析、共用進程規則與資料匯入核心
- `QMAH.Web` 維護 ASP.NET Core MVC 與 Razor 的管理後台
- `QMAH.Api` 提供版本化的 `/api/v1/*` REST API（以 HTTP 資源路徑提供資料與操作的 API）
- `QMAH.Client` 提供 Angular 21.2.22 的前台開發起點，目前保留 standalone、Router、HttpClient、環境設定與 proxy

Visual Studio、VS Code 與命令列都已經有對應的啟動方式。API 與 Web 共用 SQL Server、ASP.NET Core Identity 與資料層；前台透過 API 契約取用資料。

## 後台與五個 Area

後台導入共用的 Tabler（管理介面元件與樣式）骨架，包含側欄、頁首、登入狀態、深淺色模式、響應式列表、排序、分頁、圖片大圖預覽與操作回饋。Game、Catalog、Social、User、Store 五個 Area 都已放入共同導覽與各自的管理入口。

目前後台已整理的功能包括：

- 文物清單、詳情、軟刪除、圖片預覽與文物資料匯入
- 題庫設定、鑰匙定義、會員鑰匙背包與鑰匙流水
- 多人遊戲房間、玩家、回合、作答、投票與紀錄查詢
- 社群貼文、留言、檢舉、活動審核、發布與活動貼文同步
- 會員、角色、狀態、個人資料、地址、點數背包與成就管理
- 商品、訂單、優惠券定義、會員優惠券背包與優惠券流水
- 營運中心的跨 Area 摘要、逐日明細、媒體索引與稽核紀錄

活動、貼文、會員地址與可共用地址欄位目前使用簡單的地圖連結串接。後台保存地點文字與選填的成對座標，再由共用原生 JavaScript 開啟 OpenStreetMap 查看或搜尋，不保存圖磚資料或地圖服務識別碼。前台沿用同一組 API 欄位的方式記錄於[地點與地圖串接說明](18-map-integration.md)。

## API 與文件契約

API 已加入共用的 `ApiControllerBase`、分頁回應、ProblemDetails（RFC 7807 標準錯誤回應格式）、Cookie 驗證、Anti-forgery（防偽請求驗證）與登入狀態處理。API 的 DTO（API 對外傳輸的資料格式）不直接暴露 Entity，前台使用的資料欄位由各 Controller 明確組合。

目前可使用的 API 範圍涵蓋：

- 註冊、登入、登出、目前會員資料與地址
- 文物、分類、年代、題庫與圖片資料
- 多人遊戲房間、回合、作答、投票與排行榜
- 社群貼文、留言、活動、活動報名與受控圖片
- 商品、商品評價、購物車、訂單與優惠券
- 會員點數、鑰匙、圖鑑解鎖、成就、稱號與 Mini Game 預留契約
- 管理摘要與 metadata（供前台使用的選項資料）

OpenAPI（API 的標準契約格式）與 Scalar（互動式 API 文件頁面）已能在 API 啟動後提供測試入口。`docs/13-rest-api.md`、`docs/16-api-glossary.md` 與程式中的 OpenAPI catalog 共同維持路由、權限、請求資料與回應說明。

## 資料庫、圖片與部署準備

資料庫維持 SQL Server DB-first。`Schema.sql`、完整 `QMAH.sql`、增量 patch、seed 腳本與 Release 資料庫快照負責提供資料庫來源；Entity 與 Fluent mapping 依此對照，不使用 EF Migration 作為第二套結構來源。

這段期間加入或整理了：

- 可由 SQL 或 `.bak` 還原的完整參考資料庫與 Release 驗證流程
- API 與 Web 的本機資料庫連線解析、LocalDB 備援與啟動診斷
- 媒體邏輯路徑、Local／Cdn（內容傳遞網路）網址解析與本機設定範本
- Azure Blob Storage／Front Door 與 Cloudflare Proxy／R2 的未來路徑對照、快取與同步說明
- 文物、商品、會員頭像、成就圖示與社群媒體的公開／受保護交付界線
- 展示會員、地址、成就、訂單、商品與社群內容的可重建資料工具

目前本機預設固定使用 `Media:DeliveryMode=Local`。資料庫只保存 `/media/...` 與 `/uploads/...` 邏輯路徑，未來切換 CDN 時由網址解析器與檔案同步流程處理，不需要批次改寫資料庫。

## 經濟系統與前台預留契約

在既有 PointBalance、PointTransaction、KeyDefinitions、UserKeyBalances、KeyTransactions、ArtifactUnlocks、CouponDefinition、UserCoupon 與 UserAchievement 的基礎上，現階段已整理出前台之後會使用的規則邊界：

- 鑑定點數與四種鑰匙沿用既有資產資料表
- NORMAL、CATEGORY、ERA 由伺服器決定候選與隨機結果，UNIVERSAL 才接受前台指定文物
- 鑰匙兌換比例、鑰匙回收點數、多人遊戲獎勵與 Mini Game 獎勵集中成可調設定
- Mini Game 使用共用的 mode、attempt、config、result 與 reward 紀錄，不為每種玩法建立另一張獨立 Attempt 表
- 鑰匙進度採累積方式，達到後台設定的門檻才轉成一般鑰匙；獎勵回應會同時提供點數與進度結果
- 折價券區分 `POINT_EXCHANGE` 與 `ADMIN_GRANT`，每次會員取得都建立獨立的 UserCoupon instance（一次取得的券紀錄）
- 優惠券從 `IssuedAt` 計算 `ExpiresAt`，過期改為 `EXPIRED` 並保留歷史
- 成就與稱號屬於展示與 Prestige（成就展示進程），不反向發放點數、鑰匙或優惠券
- 目前配戴稱號獨立保存，每位會員最多一筆，且只能指向已取得的成就
- 每日登入歷史與登入成就判定集中在 `common.DailyMemberActivities` 與共用活動服務；登入天數、連續天數與登入率由歷史資料即時計算，同日重複登入只累計次數
- 官方活動與會員私人房間共用加碼結算服務；官方使用無限量規則，會員使用預算與背包受限的有限量規則

完整的暫定數值與 API 取用方式集中在[economy-progression.md](economy-progression.md)。

## 稽核與營運中心

點數與鑰匙的個人調整都透過交易紀錄更新餘額，管理員需要填寫原因，餘額不直接由表單覆寫。優惠券以 Grant／Revoke 方式處理，撤銷資料保留在原列並留下管理員、時間與原因。

除了各背包提供逐人調整，營運中心也有批次資產活動入口。批次操作可以依會員關鍵字、角色、狀態、建立日期與點數範圍篩選對象，先預覽再執行；批次主檔記錄條件快照、操作人、原因、目標數量、成功數量與結果，個別點數流水或優惠券紀錄則回指批次主檔。

營運中心將一般資產流水與批次活動分開統計。前者用於對帳與查詢所有點數、鑰匙及進度異動，後者用於查看活動或特殊原因造成的會員資產變化，避免把日常逐人操作誤算成一次全體活動。

## 展示資料與文件

展示資料工具增加了真實公開藝文場館地址的使用規則、線上活動的地點格式與地點文字／座標一致性檢查。展示活動是 QMAH 課程專題中的虛構情境；實體地點使用真實公開場館地址，只用於位置與地圖功能展示，不代表場館實際主辦、合作或授權。

文件也補齊了：

- API、前台、資料庫、圖片交付與啟動流程
- OpenAPI 名詞與每個條目可獨立閱讀的說明方式
- 本機展示帳號、SQL／`.bak` 還原與 Release 資料庫流程
- 前台透過 API 使用地圖、圖片、登入與錯誤回應的接手說明
- 本文件記錄的期中基準後功能增量
