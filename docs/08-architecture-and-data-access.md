# 架構與資料存取規則

QMAH 是一個共用 SQL Server 與 Identity 的專題，包含後端共用層、Razor 前端管理後台、獨立 REST API、Angular 前端使用者前台與資料處理工具。拆分的目的是讓技術責任清楚、方便雙啟動，不是把同一份資料模型複製成多套。

## 目前的資料流

```text
Razor 後台 ─┐
REST API ───┼─> QMAH.Infrastructure ─> QmahDbContext ─> SQL Server
匯入工具 ──┘
```

Angular 前端使用者前台以 `QMAH.Client` 作為期末畫面開發入口，透過 `QMAH.Api` 後端 API 的 JSON 契約取資料。Razor 前端管理後台與 API 使用不同主機與連接埠，但必須指向同一個資料庫，不可各自建立 Entity、Identity 或第二套 Schema。

## 專案責任與協作界線

| 專案 | 責任 | 協作界線 |
| --- | --- | --- |
| `QMAH.Infrastructure` | 後端共用的 DB-first Entity、Identity Model、`QmahDbContext`、跨主機流程與匯入核心 | 供 API 後端、Razor 後台主機與資料工具共用規則 |
| `QMAH.Web` | ASP.NET Core 後端主機內的 Razor 前端管理後台、五個 Area、後台登入與管理操作 | 管理頁面使用自己的 ViewModel 與共用 Layout |
| `QMAH.Api` | ASP.NET Core 後端主機、`/api/v1` REST Controller、DTO、ProblemDetails、Cookie 驗證與開發文件入口 | 供 Angular 前端使用者前台與其他 client 以 JSON 契約呼叫 |
| `QMAH.Client` | Angular 21.2.22 前端使用者前台、路由、API 呼叫與畫面功能 | 透過 API DTO 取得資料，沿用共用驗證與媒體網址規則 |
| `tools/QmahDataTools` | 產生、預檢、匯入與匯出資料；可重現且可在命令列驗證 | 供開發與資料整合流程建立可直接使用的資料庫 |

## 檔案放置

```text
QMAH.Infrastructure/
├─ Data/QmahDbContext.cs
├─ Models/Entities/                  # SQL Server DB-first Entity
├─ Models/Identity/                   # ApplicationUser 與 Identity 對照
├─ Infrastructure/CatalogImport/     # 文物／題庫／商城匯入核心
└─ Services/Social/                  # 活動與社群貼文共用同步流程

QMAH.Api/
├─ Controllers/V1/                   # API Controller 與 DTO
└─ Infrastructure/                   # API 主機專用的驗證、媒體儲存設定

QMAH.Web/
├─ Areas/<Area>/Controllers/         # 五個 Area 的後台 Controller
├─ Areas/Catalog/ViewModel/          # Catalog 既有的 Area ViewModel
├─ Areas/Game/ViewModels/            # Game 既有的 Area ViewModel
├─ Areas/Social/Models/              # Social 既有的 Area ViewModel
├─ Areas/Store/ViewModels/            # Store 既有的 Area ViewModel
├─ Areas/User/ViewModels/             # User 既有的 Area ViewModel
├─ Controllers/OperationsController.cs
├─ Infrastructure/                   # 後台顯示文字、稽核 Filter
├─ Models/                           # 根後台 ViewModel
└─ Views/                            # 根後台與共用 Layout

QMAH.Client/src/app/
├─ app.config.ts
├─ app.routes.ts                     # 前台功能路由集中入口
└─ app.ts
```

DB-first Entity 不搬進 Area，也不複製到 API。某個 Entity 同時被社群、商城或遊戲關聯使用時，仍以 `QMAH.Infrastructure.Models.Entities` 的同一份類別為準。

各 Area 的 ViewModel 資料夾名稱保留既有專案慣例；新增檔案時沿用所屬 Area 的現有位置，不要只為了統一資料夾名稱而搬動整個 Area。

## Controller、ViewModel 與 DTO

```text
Razor View ⇄ Area ViewModel ⇄ QMAH.Web Controller ⇄ QmahDbContext
Angular    ⇄ DTO            ⇄ QMAH.Api Controller ⇄ QmahDbContext
```

- Razor ViewModel 只放該頁需要顯示或接收的欄位；表單不直接以 Entity 綁定。
- API DTO 是前端使用者前台可依賴的 JSON 契約，不回傳 `PasswordHash`、Token、內部玩家識別值或不必要的資料庫欄位。Angular 21.2.22 開發入口已配置 `/api/v1` 相對路徑、Cookie credentials 與 `XSRF-TOKEN-API`／`X-XSRF-TOKEN` 對應；前端畫面開始製作時直接沿用這個邊界。
- Controller 負責路由、授權、ModelState、ProblemDetails／頁面導向與輸入邊界。
- `QmahDbContext` 由 DI 注入，每個 request 使用 scoped context；不要在 Action 內自行 `new` DbContext。
- 避免建立只轉接一個屬性的 Wrapper、Generic Repository 或每張表一個 Service。EF Core 已提供查詢、追蹤與交易能力。

API Controller 使用資源名稱命名，例如 `CatalogController`、`SocialController`、`MeController`、`StoreOrdersController`。`MeController` 只代表目前登入者這個資源，不取代其他資源 Controller；新增功能應依資源責任命名，不把所有 Endpoint 塞進單一 Controller。

## 什麼時候建立 Service

單表清單、詳情與簡單 CRUD 可以直接由 Controller 使用 `QmahDbContext`。只有出現下列情況才建立用途明確的 Service：

- 同一個操作要在交易中更新多張表。
- 狀態轉移、失敗復原或重複規則已經不適合留在 Action。
- API、Razor 後台與匯入工具需要共用同一套規則。
- 需要呼叫檔案系統、外部 HTTP、付款或寄信服務。
- 流程需要在不啟動 MVC 的情況下單獨測試。

目前的活動建立流程由 `EventSocialPostSynchronizer` 共用，因為活動與活動貼文必須維持一致；文物匯入由 `QMAH.Infrastructure/Infrastructure/CatalogImport` 共用，因為後台與 CLI 必須得到相同的預檢、同步與冪等結果。除此之外，不預先建立空介面或空 Service。

## 資料邊界

文物、題庫與商城商品是三種不同責任：

- `catalog.Artifacts` 保存來源、授權、分類、年代與圖鑑資料。
- `game.ArtifactQuestionEntries` 保存題庫難度、題型與是否可出題；題庫同步預設開啟。
- `store.Products` 保存商品文案、價格、庫存與營運狀態；是否同步商城由匯入者明確選擇。

三者以 `ArtifactId` 關聯，但不把商城欄位塞進文物，也不讓匯入覆蓋人工庫存與上架狀態。文物圖鑑的官方圖片維持既有結構與公開規則；社群上傳圖片則是另一個 `social.MediaAssets` 資料邊界，不能混用。

公告不是獨立的編輯流程，而是 `social.SocialPosts` 的特殊貼文類型；活動仍是 `social.Events` 的獨立資料，核准／發布後可同步產生一篇活動貼文。舊 `social.OfficialAnnouncements` 僅為既有資料相容保留，新功能不再新增另一套公告來源。

## Identity 與安全邊界

- `ApplicationUser`、角色、密碼、Claim、Login 與 Token 使用 ASP.NET Core Identity API。
- Profile、地址、通知、成就等 QMAH 業務資料使用 `QmahDbContext`。
- 後台與 API 使用 Cookie 驗證；API 的 unsafe request 仍需 Anti-forgery token。
- Controller 與 API 都必須重新檢查授權、外鍵、狀態、數量與擁有者，不只依賴畫面隱藏按鈕。
- Razor 預設 HTML encode；不對使用者輸入使用 `Html.Raw()`。
- 上傳檔案要檢查大小、檔案簽章、路徑邊界與資料庫關聯；原始檔名只作顯示，不直接當儲存路徑。
- 稽核紀錄只保存操作者、目標、時間與結果，不保存密碼、Cookie、Token 或完整 request body。

## DB-first 變更流程

QMAH 不使用 EF Migration、不呼叫 `EnsureCreated()` 或 `Migrate()`。資料表、欄位、索引、外鍵、CHECK constraint 與預設值以 SQL Server 為準。

1. 先說明資料表與既有 Area 的影響。
2. 在 SQL Server 與 `database/Schema.sql` 定案結構。
3. 以工具產生或核對 DB-first Entity 與 `QmahDbContext`，暫存輸出放在工作區外。
4. 同步更新共用流程、API DTO／文件與必要的展示資料。
5. 遠端版本若有 Schema 或資料契約變更，要求以最新版完整 `.bak` 或 `database/QMAH.sql` 乾淨重建資料庫；快照應已包含該版本共同資料，不要求組員自行增量匯入。不可讓網站啟動時偷偷建表或修改既有 Schema。
6. 重新執行 schema、資料列、EF model 與完整 SQL snapshot 的驗證。

課堂 Scaffold 或 DB-first 工具只負責產生起始碼與對照結果。產生後仍要檢查 namespace、Identity 關聯、ViewModel、授權、Anti-forgery、狀態規則與空資料畫面，不能把產生結果直接視為完成。

## 開發時的簡單判斷

| 情況 | 做法 |
| --- | --- |
| 單表後台清單／編輯 | Area Controller + ViewModel + `QmahDbContext` |
| 跨表同步或交易 | 具體名稱的 Service + 一個明確交易範圍 |
| 前端使用者前台讀寫 JSON | `QMAH.Api` 的 resource Controller + DTO |
| 文物批次資料 | 先用資料工具產生／預檢，再由後台或 CLI 套用 |
| 尚未確定的未來需求 | 先保留清楚的資料欄位與 API 邊界，不先建立空模組 |

這樣可以保留課堂專案容易理解的 Controller／ViewModel 寫法，同時讓 API、匯入工具與資料層在前台開始製作後不必重新複製或搬遷。
