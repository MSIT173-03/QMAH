<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo.svg">
    <img src="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg" width="560" alt="QMAH 清明鑑定屋">
  </picture>
</p>

# QMAH｜清明鑑定屋

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

<p align="center">
  <a href="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml"><img src="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://github.com/MSIT173-03/QMAH-Database/tree/db-v0.7.0"><img src="https://img.shields.io/badge/database-db--v0.7.0-315E55" alt="Database snapshot db-v0.7.0"></a>
  <img src="https://img.shields.io/badge/.NET-10.0-512BD4" alt=".NET 10">
  <img src="https://img.shields.io/badge/SQL%20Server-DB--first-315E55" alt="SQL Server DB-first">
</p>

## 專案簡介

「清明鑑定屋」是 QMAH 的既有專案名稱，名稱來源為《清明上河圖》。產品本身是以 ASP.NET Core、Angular、REST API 與 SQL Server DB-first 為核心的 Web 專題；實際功能與範圍以產品程式、Schema 與 API 契約為準。

網站以文物資料作為共用資料核心，現有程式包含圖鑑、多人鑑定遊戲、社群與活動、會員資料，以及文物對應的課程示意商品。五個 Area 位於同一個 Solution，共用 `QMAH` SQL Server 資料庫、ASP.NET Core Identity、媒體路徑與資料存取規則。

目前已備妥：

- SQL Server Schema、Entity 對照與 `QmahDbContext`。
- ASP.NET Core Identity 資料表、Cookie 登入與角色授權。
- 256 件文物、256 筆題庫設定、256 件對應商城商品，以及各 Area 可直接使用的共同資料。
- 8 個文物分類、網站圖片、資料處理工具，以及由 QMAH-Database 提供的完整 SQL Snapshot。
- Game、Catalog、Social、User、Store 五個 Area 的既有 Razor 管理後台與可延伸的管理頁。
- `/api/v1/*` REST API、DTO、分頁、ProblemDetails、Cookie 驗證與開發用 OpenAPI／Scalar。
- 管理員可使用的文物資料 Preview → Import 流程；題庫預設同步，商城同步由管理員選擇。
- `QMAH.Client` Angular 21.2.22 前台骨架、API proxy、VS Code 擴充套件自動安裝設定與前台交接文件。
- DB-first、資料存取、前端、展示資料、匯入工具與 Git 協作文件。

目前的工作重點是以既有 API 與資料契約製作前台畫面；Razor 管理後台可獨立維護，正式金流與完整多人遊戲互動則依各 Area 的既有範圍持續擴充。

### Angular 21.2.22 的版本理由

課程要求使用 Angular 21，因此 `QMAH.Client` 維持 Angular 21，不升到 Angular 22。原本的 Angular 21.1.3 相依樹在本機 `npm audit` 會列出漏洞；升到 Angular 21 版本線內的 21.2.22 後，已通過 `npm audit --audit-level=high`。這次只更新同一個 major version 內的次版本與修補版本，既有 standalone、Router、HttpClient、環境設定與 SCSS 寫法不需要改寫。

Angular 官方版本相容表把 21.0、21.1 與 21.2 放在相同的 Node.js、TypeScript 與 RxJS 相容範圍內；目前專案使用 TypeScript 5.9.3、RxJS 7.8.2，Node.js 以 `QMAH.Client/package.json` 的 engines 為準。完整版本資訊見 [Angular 使用者前台開發文件](https://msit173-03.github.io/QMAH-Docs/frontend/angular-development.html) 與 [Angular Version Compatibility](https://angular.dev/reference/versions)。

## Repository 分工與四個入口

| Repository | 責任 |
| --- | --- |
| [QMAH](https://github.com/MSIT173-03/QMAH) | 產品程式、`Schema.sql`、`VERSION`、開發工具與最小入口文件 |
| [QMAH-Docs](https://github.com/MSIT173-03/QMAH-Docs) | 繁體中文開發文件與 VitePress 文件站來源 |
| [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) | 可直接還原的完整 SQL Server Snapshot、manifest 與版本歷史 |
| [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/) | 以 QMAH-Docs 同一批 Markdown 建置的搜尋與側欄介面 |

完整資料庫 Snapshot 不再放回產品程式 Repository；主 Repository 的 `database/Schema.sql` 是可 review 的結構契約，`database/VERSION` 標記目前相容的 Database tag。

## 開始開發

### 1. 準備工具

優先使用 Visual Studio 2026，並包含 **ASP.NET and web development** 工作負載；也可以使用 Visual Studio Code（以 2026 年目前穩定版為準）搭配 Repository 內的 `.vscode` 設定。`.vsconfig` 指定必要的 Visual Studio 工作負載，`global.json` 指定 .NET SDK 基準為 10.0.301，並允許同一個 .NET 10.0 版本線中已安裝的較新 feature band 與 patch。

Clone 後開啟 `QMAH.sln`。若本機缺少工作負載，Visual Studio 會依 `.vsconfig` 顯示提示。Visual Studio 2022 不作為本專案文件的優先版本；若現有環境仍使用其他相容 IDE，仍須以 Solution、`.csproj`、`.vscode` 與鎖定檔的實際結果為準。

官方環境參考： [.NET `global.json` 概觀](https://learn.microsoft.com/en-us/dotnet/core/tools/global-json)、[Visual Studio 安裝設定匯入與匯出](https://learn.microsoft.com/en-us/visualstudio/install/import-export-installation-configurations?view=visualstudio)。

### 2. 建立本機 QMAH 資料庫

目前相容的完整 Snapshot 是 QMAH-Database tag `db-v0.7.0` 的 [`QMAH.sql`](https://github.com/MSIT173-03/QMAH-Database/blob/db-v0.7.0/QMAH.sql)，也可以使用其 [Raw 檔案](https://raw.githubusercontent.com/MSIT173-03/QMAH-Database/db-v0.7.0/QMAH.sql)。在 SSMS 連線到可用的本機 SQL Server instance，完整執行 SQL，資料庫名稱使用 `QMAH`。

若另有同一版本且已驗證的 `.bak`，可以在 SSMS 使用 **Restore Database...** 還原；QMAH 主 Repository 的 Release 目前只保留版本導覽，不再提供 SQL／BAK 資產。完整的還原資料、資料表數量、狀態值與展示資料規則見 [QMAH-Docs 開發資料文件](https://msit173-03.github.io/QMAH-Docs/getting-started/development-data.html)。

不需要先執行 `database/Schema.sql`、Migration、Patch 或 Seed。網站啟動時不會建立資料庫、建表、覆寫資料或套用 Migration；完整 Snapshot 已包含目前共同資料。

### 3. 啟動後端

QMAH 有兩個 ASP.NET Core 主機：`QMAH.Web` 提供 Razor 管理後台，`QMAH.Api` 提供 REST API。兩者共用 `QMAH.Infrastructure`、Identity 與同一個 SQL Server 資料庫。

| 主機／設定 | 用途 | HTTPS／HTTP 網址 |
| --- | --- | --- |
| `QMAH.Web` 的 `https`／`http` | Razor 管理後台與五個 Area | `https://localhost:7039`／`http://localhost:5183` |
| `QMAH.Api` 的 `https`／`http` | `/api/v1/*`、OpenAPI 與 Scalar | `https://localhost:7249`／`http://localhost:5147` |

Visual Studio 2026 開啟 `QMAH.sln` 後，可選擇 `QMAH 後端主機與管理後台（API＋Razor）` 一次啟動兩個後端主機；若只要檢查 API，選擇 `QMAH API`。如果 IDE 沒有顯示 `.slnLaunch` 設定，仍可分別啟動兩個專案的 `https` profile。

命令列啟動：

```powershell
dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile https
dotnet run --project .\QMAH.Web\QMAH.Web.csproj --launch-profile https
```

### 4. 啟動 Angular 使用者前台

使用 2026 年目前穩定版的 Visual Studio Code 開啟 Repository 根目錄後，在 **Run and Debug** 選擇 `QMAH 使用者前台開發（API 後端＋Angular 前端）`；也可以分別啟動 `QMAH API（https）` 與 `QMAH Angular 前端使用者前台`。

需要手動啟動時，在另一個終端機執行：

```powershell
cd QMAH.Client
npm ci
npm start
```

瀏覽器開啟 `http://localhost:4200/`。前台的 `/api`、`/openapi` 與 `/scalar` 會透過 `QMAH.Client/proxy.conf.json` 轉送到 `https://localhost:7249`。

## 本機資料庫自動尋找

程式會自動尋找本機可用的 QMAH 資料庫；`Server=.;Database=QMAH` 只是 `QMAH.Api/appsettings.json` 與 `QMAH.Web/appsettings.json` 的預設候選與全部候選失敗時的 fallback，不是資料庫必須存在的位置。

`QmahDatabaseConnectionResolver` 在 `QmahDatabaseDiscovery:Enabled` 為 `true` 時，依序檢查設定值、標準 LocalDB `(localdb)\MSSQLLocalDB`、`sqllocaldb info` 列出的 LocalDB instance，以及 Windows 登錄檔列出的本機 SQL Server instance。每個候選都透過 `master.sys.databases` 確認名稱為 `QMAH` 且狀態為 `ONLINE`，找到第一個可用候選後交給 `AddDbContext`。所有候選都不可用時，才回到設定值或預設值。

這是本機 instance 探索，不會掃描網路，也不會自動附加 `.mdf` 或還原 `.bak`。需要固定目標時，可在 `QMAH.Api/appsettings.Local.json` 與 `QMAH.Web/appsettings.Local.json` 分別覆寫 `QmahDatabase`；兩個主機仍須指向同一個資料庫。需要停用自動尋找時，加入：

```json
{
  "QmahDatabaseDiscovery": {
    "Enabled": false
  }
}
```

官方參考：[ASP.NET Core Configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0)、[SQL Server Express LocalDB](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb?view=sql-server-ver17)。

## 常見啟動問題

### 431 Request Header Fields Too Large

如果瀏覽器開啟 `https://localhost:7039` 時顯示 `431 Request Header Fields Too Large`，通常是瀏覽器保留了舊版或重複的 `localhost` Cookie，不是 NuGet 還原或專案載入失敗。Web 與 API 使用不同的固定 Cookie 名稱，啟動後會清除已知的舊版 QMAH／ASP.NET Core 登入與 Anti-forgery Cookie；只要標頭仍在 Kestrel 可接收的有限範圍內，清理會自動完成，不需要刪除資料庫內容。

如果 request 尚未進入應用程式前就再次回傳 431，代表 Cookie 已超過伺服器可解析的上限。請先關閉本機網站分頁，再從網址列左側的鎖頭開啟網站資料設定，清除 `localhost` 的 Cookie 與網站資料後重新啟動；也可以先用無痕視窗確認登入頁是否恢復正常。清除後本機登入狀態會消失，需要重新登入，但不會刪除資料庫內容。

Cookie 不包含連接埠，因此要清除 `localhost` 的網站資料，不要只尋找 `7039`。若仍無法開啟，請確認沒有同時保留多個舊的 QMAH Web／API 程序，再重新啟動 `QMAH 後端主機與管理後台（API＋Razor）`。

### 無法連線或找不到資料表

先確認資料庫名稱為 `QMAH`，再在 SSMS 查看實際連線的 instance 是否存在且為 `ONLINE`。啟動記錄會列出 `QmahDatabaseConnectionResolver` 的候選與選用結果；`(localdb)\MSSQLLocalDB` 只是候選之一。若只有空資料庫，請重新使用 QMAH-Database 的完整 `QMAH.sql` 或同版本 `.bak`，不需要以 Patch 或 Seed 補資料。

### HTTPS 憑證警告

可先使用 `http` 啟動設定開發。需要 HTTPS 時，依 Visual Studio 提示信任本機開發憑證。

## 本機展示帳號

若要在隔離資料庫重建展示會員，先把根目錄的 `QMAH.DemoCredentials.csv` 複製成未提交的 `QMAH.DemoCredentials.local.csv`，再填妥所有 Password 欄位。展示資料工具會優先讀取這份根目錄檔案，並在同一位置建立備份；缺少帳號或留白密碼時會直接停止，絕不自動產生隨機密碼。

常用展示帳號：

| 帳號 | 用途 |
| --- | --- |
| `admin@qmah.local` | 後台與營運中心管理員 |
| `catalog@qmah.local` | 文物圖鑑情境 |
| `game@qmah.local` | 遊戲情境 |
| `social@qmah.local` | 社群與活動情境 |
| `store@qmah.local` | 商城情境 |
| `user@qmah.local` | 會員、地址與個人資料情境 |
| `player-a@qmah.local`、`player-b@qmah.local` | 遊戲玩家情境 |

密碼只存在 Repository 外的未提交 credentials 檔案或密碼管理工具。忘記密碼時，使用 `reset-password` 只重設指定的隔離資料庫；不要把密碼、Cookie、Token 或本機 log 放進 Git。完整命令見 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html)。

## 開發前的資料與程式界線

### SQL Server 是結構基準

本專案採 DB-first。資料表、欄位、外鍵與約束以 SQL Server Schema 為準；Entity、Fluent mapping 與 `QmahDbContext` 是程式端對照：

```text
SQL Server Schema → Entity／Fluent mapping → QmahDbContext → Controller／Service → ViewModel → View
```

不要使用 `Database.Migrate()`、`EnsureCreated()` 或新增 EF Migration，也不要只修改 Entity。需要變更 Schema 時，必須同步檢查 SQL、Entity、DbContext、文件與 QMAH-Database Snapshot。EF Core 的通用 DB-first 說明見 [Managing Database Schemas](https://learn.microsoft.com/en-us/ef/core/managing-schemas/) 與 [Reverse Engineering](https://learn.microsoft.com/en-us/ef/core/managing-schemas/scaffolding/)。

### DbContext 由 DI 提供

Controller 透過建構式取得 scoped `QmahDbContext`，不重新建立 SQL 連線，也不使用 `new QmahDbContext()`。一般清單查詢使用 `AsNoTracking()`；表單使用 ViewModel、`ModelState` 與 `[ValidateAntiForgeryToken]`。查詢、寫入、交易、Identity 與 `RowVersion` 的完整實例見 [資料存取與 DB-first](https://msit173-03.github.io/QMAH-Docs/architecture/data-access.html)。

### 後端、管理後台與使用者前台的界線

目前採三個可獨立啟動的應用程式與一個共用資料層：`QMAH.Web` 專注 Razor 管理後台，`QMAH.Api` 提供 `/api/v1/*`，`QMAH.Client` 提供 Angular 使用者前台；`QMAH.Infrastructure` 集中 DB-first Entity、`QmahDbContext` 與匯入核心。API 與 Angular 透過 `QMAH.Client/proxy.conf.json` 連接，Visual Studio 的 `.slnLaunch` 預設同時啟動 API 與 Razor 管理後台，VS Code 工作區則提供 API＋Angular 的複合啟動。

Angular 不直接連資料庫，也不依賴管理後台的 ViewModel；前台欄位、狀態、權限與錯誤回應以 [REST API 契約](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html) 為準。

## 五個 Area

| Area | 負責內容 | 起始網址 |
| --- | --- | --- |
| `Game` | 房間、玩家、回合、選題、作答、投票 | `/Game` |
| `Catalog` | 文物、分類、年代、題庫設定、鑰匙、解鎖 | `/Catalog` |
| `Social` | 貼文（含官方公告類型）、留言、檢舉、活動、通知 | `/Social` |
| `User` | Identity 帳號、個人資料、地址、會員紀錄 | `/User` |
| `Store` | 商品、購物車、折價券、訂單、付款、點數、庫存 | `/Store` |

各 Area 共用同一個資料庫，但只維護對應的畫面與流程。讀取其他系統資料時，先確認資料責任與歷史紀錄是否允許變更，再決定唯讀查詢或建立明確的跨表 Service。詳細資料界線見 [Area 責任與資料界線](https://msit173-03.github.io/QMAH-Docs/architecture/area-boundaries.html)。

## 文物、題庫與商城商品

三份資料都以 `ArtifactId` 指向同一件文物，不靠名稱或字串拆解比對：

| 資料表 | 保存內容 | 與文物的關係 |
| --- | --- | --- |
| `catalog.Artifacts` | 分類、年代、說明、尺寸、圖片、來源與授權 | 文物主資料 |
| `game.ArtifactQuestionEntries` | 題型、難度、是否可出題 | 每件文物最多一筆題庫設定 |
| `store.Products` | 商品名稱、文案、尺寸、售價、庫存與上架狀態 | 每件文物最多一件商品 |

商城不直接使用來源商城的圖片與售價，因為來源商城素材的開放授權標示不如故宮 Open Data 文物圖片明確。資料工具會把同一件文物轉成「文物名稱－縮小複製品」商品，沿用已標示授權的圖片，另外產生商品文案、二分之一尺寸與依年代、分類計算的示意售價。商品資料可以獨立調整，不會改寫圖鑑與題庫；訂單明細另存成交時的品名與單價快照。

文物資料的 `LicenseCode`、`SourceUrl` 與 `AttributionText` 必須保留。故宮資料頁未明確標示授權時，不因課程用途就視為可公開使用；商城商品是課程示意資料，不代表國立故宮博物院官方商品、實際製造品或市場售價。來源與授權規則見 [資料與圖片使用說明](https://msit173-03.github.io/QMAH-Docs/features/data-and-media.html)；官方資料見 [故宮典藏資料檢索－Open Data](https://digitalarchive.npm.gov.tw/opendata/)。

## 文件入口

正式開發文件保留在 [QMAH-Docs Repository](https://github.com/MSIT173-03/QMAH-Docs)，同一批 Markdown 由 [VitePress 文件站](https://msit173-03.github.io/QMAH-Docs/) 建置。首頁提供完整循序路線與六個快速查詢頁：

| 快速頁 | 直接進入 |
| --- | --- |
| Catalog | [圖鑑與文物](https://msit173-03.github.io/QMAH-Docs/quick-reference/catalog.html) |
| Game | [遊戲與作答](https://msit173-03.github.io/QMAH-Docs/quick-reference/game.html) |
| Social | [社群與活動](https://msit173-03.github.io/QMAH-Docs/quick-reference/social.html) |
| User | [會員與 Identity](https://msit173-03.github.io/QMAH-Docs/quick-reference/user.html) |
| Store | [商城與訂單](https://msit173-03.github.io/QMAH-Docs/quick-reference/store.html) |
| Shared | [共用基礎](https://msit173-03.github.io/QMAH-Docs/quick-reference/shared.html) |

完整順序：

1. [開發環境與啟動](https://msit173-03.github.io/QMAH-Docs/getting-started/development-environment.html)
2. [開發資料與本機展示](https://msit173-03.github.io/QMAH-Docs/getting-started/development-data.html)
3. [系統架構總覽](https://msit173-03.github.io/QMAH-Docs/architecture/system-overview.html)
4. [Area 責任與資料界線](https://msit173-03.github.io/QMAH-Docs/architecture/area-boundaries.html)
5. 依系統快速頁進入前端、管理後台、功能與 API 正規文件。
6. 需要精確欄位、HTTP 行為、工具參數或版本交付規則時，查閱 [參考文件](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html)。

## Repository 內入口

- [資料庫責任與 Snapshot 路標](database/README.md)
- [文件入口](docs/README.md)
- [貢獻與協作規則](CONTRIBUTING.md)
- [資料工具入口](tools/QmahDataTools/README.md)
- [QmahDatabaseRelease 工具說明](tools/QmahDataTools/QmahDatabaseRelease/README.md)
- [QMAH-Docs 官方參考索引](https://msit173-03.github.io/QMAH-Docs/reference/official-references.html)

## Repository 結構

```text
QMAH/
├─ QMAH.sln
├─ QMAH.slnLaunch
├─ QMAH.DemoCredentials.csv       展示帳密空白範本
├─ QMAH.Api/                      REST API 主機
├─ QMAH.Infrastructure/           DB-first Entity、DbContext 與匯入核心
├─ QMAH.Web/
│  ├─ Areas/                       五個功能模組
│  ├─ Controllers/                 Razor 管理後台與共用網站頁面
│  ├─ Models/                      後台 ViewModel
│  ├─ Views/                       共用 Razor View
│  └─ wwwroot/                     樣式、腳本、套件、圖片與品牌素材
├─ QMAH.Client/                    Angular 21.2.22 使用者前台
├─ database/
│  ├─ README.md                    資料庫路標
│  ├─ Schema.sql                   DB-first 結構契約
│  └─ VERSION                      相容 Snapshot tag
├─ docs/README.md                  文件 Repository 路標
├─ tools/QmahDataTools/            可重現的資料處理工具
├─ CONTRIBUTING.md                 協作規則
└─ README.md
```

Logo、獨立圖標與 favicon 位於 `QMAH.Web/wwwroot/images/brand/`。請直接引用現有檔案，不要在各 Area 複製或重新改色。

## Git 協作

```text
feature/<area> → Pull Request → develop → Pull Request → main
```

| 分支 | 用途 |
| --- | --- |
| `main` | 可展示、可發布的整合版本 |
| `develop` | 已整合、待展示驗證的共同版本 |
| `feature/game` | 遊戲模組 |
| `feature/catalog` | 圖鑑模組 |
| `feature/social` | 社群模組 |
| `feature/user` | 會員模組 |
| `feature/store` | 商城模組 |

五個 Area 分支都已建立，可依 GitHub 權限直接 Push。功能變更不直接修改 `main` 或 `develop`；整合共同分支時建立 PR 留下變更紀錄。`main` 禁止 force push 與刪除。不要把 `.bak`、bin、obj、log、快取、raw output、`.mdf`、`.ldf` 或大型執行檔提交進 Repository。

## 教育用途與素材權利聲明

本 Repository 為「智慧應用微軟 C# 工程師養成班－MSIT173 期」課程專題，限於課程學習、系統開發、功能測試與專題發表，不提供實際交易服務，也不從事營利、銷售、廣告或商業授權。

文物資料與圖像取自國立故宮博物院 Open Data／典藏資料檢索系統中明確標示的開放內容，依各資料頁所載 CC0 或 CC BY 4.0 條款使用。需要姓名標示的素材，資料庫保存作品名稱、來源網址、授權代碼與 `AttributionText`。

本專題不使用來源商城商品圖片或即時售價。商城展示資料由已授權文物資料產生，不代表國立故宮博物院官方商品、實際製造品或市場售價。若素材權利標示、使用範圍或來源資訊需要補正，請透過 Repository Issue 聯繫。
