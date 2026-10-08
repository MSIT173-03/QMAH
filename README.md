<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="QMAH.Media/images/brand/qmah-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="QMAH.Media/images/brand/qmah-logo.svg">
    <img src="QMAH.Media/images/brand/qmah-logo-dark.svg" width="560" alt="QMAH 清明鑑定屋">
  </picture>
</p>

# QMAH｜清明鑑定屋

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

<p align="center">
  <a href="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml"><img src="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://github.com/MSIT173-03/QMAH-Database/tree/db-v0.12.1"><img src="https://img.shields.io/badge/database-db--v0.12.1-315E55" alt="Database snapshot db-v0.12.1"></a>
  <img src="https://img.shields.io/badge/.NET-10.0-512BD4" alt=".NET 10">
  <img src="https://img.shields.io/badge/SQL%20Server-DB--first-315E55" alt="SQL Server DB-first">
</p>

## 目前正式 Release

目前 QMAH 主程式版本是 [`v0.12.1`](https://github.com/MSIT173-03/QMAH/releases/tag/v0.12.1)，對應 [QMAH-Database `db-v0.12.1` Release](https://github.com/MSIT173-03/QMAH-Database/releases/tag/db-v0.12.1)。完整資料庫從後者下載同源的 `QMAH.sql`、`QMAH-0.12.1.bak` 與 `SHA256SUMS.txt`；主程式 Release 只提供版本與資料庫連結，不重複附上備份。

## 專案簡介

「清明鑑定屋」是 QMAH 的既有專案名稱，名稱來源為《清明上河圖》。

產品是以 ASP.NET Core、Angular、REST API 與 SQL Server DB-first 為核心的 Web 專題。實際功能與範圍以產品程式、Schema 與 API 契約為準。

網站以文物資料作為共用資料核心。現有程式包含圖鑑、多人鑑定遊戲、社群與活動、會員資料，以及文物對應的課程示意商品。

五個 Area 位於同一個 Solution，共用 `QMAH` SQL Server 資料庫、ASP.NET Core Identity、媒體路徑與資料存取規則。

目前包含：

- SQL Server Schema、Entity 對照與 `QmahDbContext`。
- ASP.NET Core Identity 資料表、Cookie 登入與角色授權。
- 512 件文物、512 筆題庫設定、512 件對應的文物明信片商品，以及各 Area 可直接使用的共同資料。
- 8 個文物分類、網站圖片、資料處理工具，以及由 QMAH-Database 提供的完整 SQL Snapshot。
- Game、Catalog、Social、User、Store 五個 Area 的既有 Razor 管理後台與可延伸的管理頁。
- `/api/v1/*` REST API、DTO、分頁、ProblemDetails、Cookie 驗證與開發用 OpenAPI／Scalar。
- 管理員可使用的文物資料 Preview → Import 流程；題庫預設同步，商城同步由管理員選擇。
- `QMAH.Client` Angular 21.2.23 前台骨架、API proxy、VS Code 擴充套件自動安裝設定與前台交接文件。
- DB-first、資料存取、前端、展示資料、匯入工具與 Git 協作文件。

目前工作重點是依既有 API 與資料契約製作前台畫面。Razor 管理後台可獨立維護。

前台共用色彩、五個系統的語意 accent、深色模式對應，以及 UI 素材／照片的使用邊界，集中記錄在 [`QMAH_UI_COLOR_SYSTEM.md`](QMAH_UI_COLOR_SYSTEM.md)；文件站同步版見 [前台色彩與視覺素材基準](https://msit173-03.github.io/QMAH-Docs/frontend/ui-color-system.html)。

正式金流與完整多人遊戲互動仍依各 Area 的既有範圍擴充。

### Angular 21.2.23 的版本理由

課程要求使用 Angular 21，因此 `QMAH.Client` 維持 Angular 21，不升到 Angular 22。

原本的 Angular 21.1.3 相依樹在本機 `npm audit` 會列出漏洞。升到 Angular 21 版本線內的 21.2.23 後，已通過 `npm audit --audit-level=high`。

這次只更新同一個 major version 內的次版本與修補版本，既有 standalone、Router、HttpClient、環境設定與 SCSS 寫法不需要改寫。

Angular 官方版本相容表把 21.0、21.1 與 21.2 放在相同的 Node.js、TypeScript 與 RxJS 相容範圍內。

目前專案使用 TypeScript 5.9.3、RxJS 7.8.2，Node.js 以 `QMAH.Client/package.json` 的 engines 為準。

完整版本資訊見[Angular 使用者前台開發文件](https://msit173-03.github.io/QMAH-Docs/frontend/angular-development.html)與 [Angular Version Compatibility](https://angular.dev/reference/versions)。

## Repository 分工與四個入口

| Repository | 責任 |
| --- | --- |
| [QMAH](https://github.com/MSIT173-03/QMAH) | 產品程式、`Schema.sql`、`database/VERSION`、開發工具與最小入口文件 |
| [QMAH-Docs](https://github.com/MSIT173-03/QMAH-Docs) | 繁體中文開發文件與 VitePress 文件站來源 |
| [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) | 可直接還原的完整 SQL Server Snapshot、manifest 與版本歷史 |
| [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/) | 以 QMAH-Docs 同一批 Markdown 建置的搜尋與側欄介面 |

產品程式 Repository 不保存完整資料庫 Snapshot。`database/Schema.sql` 是可 review 的結構契約，`database/VERSION` 標記目前相容的 Database tag。

## 開始開發

### 1. 準備工具

優先使用 Visual Studio 2026，並包含 **ASP.NET and web development** 工作負載。也可使用 2026 年穩定版 Visual Studio Code 搭配 Repository 內的 `.vscode` 設定。

`.vsconfig` 指定 Visual Studio 工作負載，`global.json` 指定 .NET SDK 基準為 10.0.301，並允許同一個 .NET 10.0 版本線中已安裝的較新 feature band 與 patch。

Clone 後開啟 `QMAH.sln`。若本機缺少工作負載，Visual Studio 會依 `.vsconfig` 顯示提示。

Visual Studio 2022 不是本專案文件的優先版本，但仍可作為目前方案的相容開發環境。使用其他相容 IDE 時，仍以 Solution、`.csproj`、`.vscode` 與鎖定檔的實際結果為準。

官方環境參考：

- [.NET `global.json` 概觀](https://learn.microsoft.com/en-us/dotnet/core/tools/global-json)
- [Visual Studio 安裝設定匯入與匯出](https://learn.microsoft.com/en-us/visualstudio/install/import-export-installation-configurations?view=visualstudio)

### 2. 建立本機 QMAH 資料庫

目前主線使用 [QMAH-Database db-v0.12.1 Release](https://github.com/MSIT173-03/QMAH-Database/releases/tag/db-v0.12.1) 的完整 Snapshot。下載 `.bak` 與 `SHA256SUMS.txt`，確認校驗值後在 SSMS 使用 **Restore Database...** 還原為 `QMAH`；或執行同版本的 `QMAH.sql`。兩者由同一次匯出產生，已通過乾淨資料庫重建與逐表比對。本版要求所有組員備份舊資料庫並全新還原；新版包含獎勵、鑑賞與重整後的關聯資料，不提供增補升級，也不需重跑舊 Seed。

只有沿用舊 `db-v0.10.2` 的環境才須執行 [`database/upgrades/0.10.2-store-order-shipping.sql`](database/upgrades/0.10.2-store-order-shipping.sql)；若確認資料庫只有展示訂單，可再手動執行 [`database/seeds/store-showcase-orders-shipping.sql`](database/seeds/store-showcase-orders-shipping.sql)。一般既有訂單不會被當成假資料重整。以 `sqlcmd` 執行舊版升級時請加 `-f 65001 -b`。

QMAH 主 Repository 的 Release 目前只保留版本導覽，不再提供 SQL／BAK 資產；下載請使用上述 QMAH-Database Release。完整的還原資料、資料表數量、狀態值與展示資料規則見 [QMAH-Docs 開發資料文件](https://msit173-03.github.io/QMAH-Docs/getting-started/development-data.html)。

使用新版 Snapshot 不需先執行 `database/Schema.sql`、Migration 或 Seed。網站啟動時不會建立資料庫、建表、覆寫資料或套用 Migration；完整 Snapshot 已包含目前共同資料。

### 3. 啟動後端

QMAH 有兩個 ASP.NET Core 主機：`QMAH.Web` 提供 Razor 管理後台，`QMAH.Api` 提供 REST API。兩者共用 `QMAH.Infrastructure`、Identity 與同一個 SQL Server 資料庫。

| 主機／設定 | 用途 | HTTPS／HTTP 網址 |
| --- | --- | --- |
| `QMAH.Web` 的 `https`／`http` | Razor 管理後台與五個 Area | `https://localhost:7039`／`http://localhost:5183` |
| `QMAH.Api` 的 `https`／`http` | `/api/v1/*`、OpenAPI 與 Scalar | `https://localhost:7249`／`http://localhost:5147` |

Visual Studio 2026 開啟 `QMAH.sln` 後，可在啟動設定選擇 `QMAH 全站（API＋前台＋管理後台）`，一次啟動 `QMAH.Api` 的 `https` profile、Angular 使用者前台與 `QMAH.Web` Razor 管理後台。啟動後可分別從 `https://localhost:7249`、`http://localhost:4200/` 與 `https://localhost:7039` 開啟。
Visual Studio 的 Angular 專案固定使用 HTTPS proxy，與複合啟動指定的 API profile 一致。

若只需要 API 與 Angular 前台，選擇 `QMAH API＋Angular 前台`；若只要檢查 API，選擇 `QMAH API`；若要測試 MVC 管理後台與 API，選擇 `QMAH API＋管理後台`。如果 IDE 沒有顯示 `.slnLaunch` 設定，仍可分別啟動兩個 ASP.NET Core 專案的 `https` profile，再依「啟動 Angular 使用者前台」的方式啟動前台。

命令列啟動：

```powershell
dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile https
dotnet run --project .\QMAH.Web\QMAH.Web.csproj --launch-profile https
```

### 4. 啟動 Angular 使用者前台

使用 2026 年目前穩定版的 Visual Studio Code 開啟 Repository 根目錄後，在 **Run and Debug** 選擇 `QMAH 使用者前台開發（API 後端＋Angular 前端）`。

也可以分別啟動 `QMAH API（https）` 與 `QMAH Angular 前端使用者前台`。

需要手動啟動時，在另一個終端機執行：

```powershell
cd QMAH.Client
npm start
```

`npm start`、`npm run start:https`、`npm run start:http`（含 Visual Studio／VS Code 啟動）會在啟動 Angular 前檢查前台套件。首次下載或拉取更新後，若缺少套件（例如 `@microsoft/signalr`）或版本與 `package-lock.json` 不符，會自動執行 `npm ci` 安裝鎖定版本，再啟動 Angular；套件齊全時不會重裝。建置、watch 與測試也使用相同檢查。自動安裝需要可用的 Node.js、npm 與套件來源；安裝失敗時會停止啟動並顯示原因。需要手動完整重裝時仍可執行 `npm ci`。

`npm start` 會偵測 API 的 HTTPS／HTTP profile 並選擇對應 proxy；`npm run start:https` 固定使用 `https://localhost:7249`。`/api`、公開 `/media`、頭貼與成就上傳圖會轉送至 API；其他 `/uploads` 在完整啟動時仍轉送至後台。

三種 npm 啟動方式也會先檢查前台連接埠（預設 4200）。若已被使用，啟動器會保持執行並等待釋放，避免 Angular 的占埠錯誤讓 Visual Studio 整組偵錯停止；先前的前台仍可使用，關閉它後會自動啟動本次前台。等待時不會重裝套件，也不會終止占用連接埠的其他程序。正常停止啟動器時，會清理它啟動的 Angular 與子程序；驗證用的前台應在驗證結束後停止。可透過 `npm start -- --port 4201` 指定其他開發埠，但自訂埠仍須同步調整後台的前台入口設定。

共用媒體素材集中在專案根目錄的 `QMAH.Media`：文物圖在 `media/catalog`，品牌、預設頭貼與 Web 圖片在 `images`，Web 字型在 `fonts`，會員頭貼與成就上傳圖在 `uploads`。API 與 Web 預設用同一個 `Media:AssetRootPath` 指向此資料夾，相對路徑以各專案的 ContentRoot 為基準。既有 `Media:RootPath`、`Avatar:RootPath`、`Avatar:PresetRootPath` 設定仍可個別覆寫對應目錄；成就上傳圖亦可用 `Achievement:RootPath` 覆寫。若兩個工作區共用一個資料庫，兩邊 API 與 Web 應設定相同的共用媒體絕對路徑。對外 `/media/catalog/...`、`/images/...`、`/fonts/...` 及 `/uploads/...` 網址不變，資料庫不需遷移。新上傳頭貼按會員 ID 分目錄，資料庫仍記錄目前使用的公開路徑。

若既有 `appsettings.Local.json` 仍指向搬空的 `QMAH.Web/wwwroot` 舊目錄，程式會改用 `QMAH.Media`；有檔案的舊目錄或其他自訂目錄仍依原設定使用，部署前請把需要保留的本機上傳檔同步到選定的共用目錄。未指定頭貼網址時，才會使用會員目錄中最新的上傳檔；既有會員指定的頭貼網址優先。

部署時將 `QMAH.Media` 放在 API、Web 發佈目錄可共同讀取的位置，並將兩個服務的 `Media:AssetRootPath` 設為同一個絕對路徑。`uploads` 是持續保留的資料，更新程式時不可覆蓋，應與資料庫一起備份；`media/catalog`、`images` 和 `fonts` 是版本管理的固定素材。API 僅公開 `/media/catalog`、`/media/store`、`/images`、`/fonts`、頭貼與成就圖片路徑，社群上傳媒體不由靜態目錄直接公開。Angular 自身的圖片及 Web 的 CSS、JS、第三方套件仍屬各自的網站建置產物，不從共用媒體目錄讀取。

### 每日簽到獎勵

每日登入頁每天可簽到領 3 點鑑定點數。連續每滿 7 天加 3 點，單日最多 6 點，每個台灣曆月最多加成 4 次、共 12 點；漏簽未補齊則重新累積。這是暫定平衡值，低於多人遊戲每場 8～20 點，不直接發鑰匙。`POST /api/v1/me/daily-activity/check-in` 在同一交易寫入 `CHECK_IN` 活動、點數餘額與 `DAILY_CHECK_IN` 流水，重送不重複發放。

可補近 7 天，每個台灣日期第一次免費；當日其餘補簽，1～3 天前扣 1 點、4～7 天前扣 2 點。補簽發基本 3 點，實得 1～3 點，不追補過去的加成，也不新增虛假的 `LOGIN` 或登入成就。`POST /api/v1/me/daily-activity/make-up` 接收日期與畫面顯示的費用，後端重新核價，費用變動時拒絕操作。獎勵流水使用 `DAILY_CHECK_IN_MAKEUP_FREE` 或 `DAILY_CHECK_IN_MAKEUP`，付費流水另記 `DAILY_CHECK_IN_MAKEUP_FEE`，共用同一活動參照，與餘額原子入帳。同一日期不得重領；註冊前、今天和 7 天以前都不能補。補簽費用直接由這次獎勵扣除，因此零點數也可補，不會倒扣原有點數。每日及加成獎勵集中於 `DailyActivityService` 常數，前端顯示 API 回傳的費用與實得點數。

### 單人遊戲求救與結算

四種單人玩法都提供「提示後繼續」與「代完成並結算」。拼圖、書畫的區域提示及翻牌的配對位置提示每次扣 3 分；同一組翻牌提示重看不重複扣分。細節辨識每排除一個錯誤選項扣 10 分，至少保留兩個選項讓玩家作答。看原圖不扣分。

代完成按未完成比例扣分，公式為 `ceil(60 × 代完成份數 / 全局份數)`，且不得 S 級；拼圖與書畫原有的時間、操作及提示扣分仍會合併計算。分數最低為 0，不會扣除持有的鑑定點數。確認代完成後直接送出結果；失敗時可沿用盤面與求救紀錄重送，不重複增加協助次數。獎勵以後端重算的評分為準，有領取獎勵的對局會計入既有每日額度。

前端提交 `scoringVersion: 3`、`hintsUsed`、`autoPlaced`；後端驗證數值範圍，並把求救紀錄保存在既有 `MiniGameAttempt.RawResultJson`，成績、獎勵與流水沿用原有交易，不需新增資料表。這些操作數據仍由客戶端回報，不能視為完整防作弊措施。多人遊戲不提供答案求救。

### 會員註冊的 Cloudflare Turnstile 設定

會員註冊使用 Cloudflare Turnstile 人機驗證。前端 Site Key 是可公開的識別碼；後端 Secret Key 用來向 Cloudflare 驗證 token，兩者必須來自同一個 widget。金鑰是否公開不會改變驗證速率。

**暫時協作設定：目前依專題協作需求，保留原會員分支的 Turnstile 金鑰組。** Angular 的 `environment.development.ts` 與 `environment.ts` 使用原本的 Site Key；API 的 `appsettings.Development.json` 暫存配對的 Secret Key。這組不是 Cloudflare 官方測試金鑰，開發時會進行實際驗證，widget 必須允許使用的網站 hostname。Secret Key 已曾提交至 GitHub，應視為已公開；這是暫時安排，README 註記不會限制他人使用金鑰。

`appsettings.Development.json` 僅供 Development 環境使用。正式部署仍須透過 `Turnstile__SecretKey` 環境變數提供配對的 Secret Key，否則會員註冊無法完成驗證。正式部署前應在 Cloudflare 輪替 Secret Key，更新部署環境變數，並移除版控中的實際 Secret Key；新 Secret Key 不再提交。只刪除設定檔中的舊值不會使已公開的金鑰失效。

若改用 Cloudflare 官方測試金鑰，前端 Site Key 與後端 Secret Key 必須一起改成配對的測試值；測試金鑰只用於開發與測試，不能提供正式的防機器人保護。參考：[金鑰與 hostname 設定](https://developers.cloudflare.com/turnstile/get-started/)、[測試金鑰](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)。

切換 CDN 時，將 API 與 Web 的 `Media:DeliveryMode` 設成 `Cdn`，並設定相同的 `Media:PublicBaseUrl`（必要時再設 `Media:PublicPathPrefix`）。API 輸出的媒體網址與 Web 圖片標籤會改寫公開的 `/media/catalog`、`/media/store`、`/images`、`/fonts`、`/uploads/avatars`、`/uploads/achievements` 網址；CDN 必須對應到同一份 `QMAH.Media`。CSS 內的固定 `/images`、`/fonts` 網址仍走站點原路徑，部署 CDN 時需在前端入口將這些路徑指向 CDN，或一併由 CDN 提供 Web 靜態建置產物。社群附件仍由受權限控管的 API 提供，資料庫內的路徑不需改成 CDN 網域。

若要使用 API 的 `http` profile，請另開終端機執行：

```powershell
dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile http
cd QMAH.Client
npm run start:http
```

這時 `/api`、公開 `/media`、頭像與 OpenAPI 請求會轉送到 `http://localhost:5147`，其他 `/uploads` 在完整啟動時轉送到 `http://localhost:5183`。HTTP 與 HTTPS 使用各自的 proxy 設定，避免把 HTTPS profile 的 307 redirect 當成 API 回應傳回前端。

需要手動使用 Angular CLI 時，HTTPS profile 可在 `QMAH.Client` 目錄執行 `ng serve` 或 `npx ng serve`；HTTP profile 請執行 `ng serve --proxy-config proxy.http.conf.json` 或 `npx ng serve --proxy-config proxy.http.conf.json`。直接使用 Angular CLI 不會執行 npm 的套件檢查，請先執行 `npm ci`；日常啟動建議使用上面的 npm 指令。

瀏覽器開啟 `http://localhost:4200/`。前台的 `/api`、`/openapi` 與 `/scalar` 會透過 `QMAH.Client/proxy.conf.json` 轉送到 `https://localhost:7249`。

## 本機資料庫自動尋找

程式會自動尋找本機可用的 QMAH 資料庫；`Server=.;Database=QMAH` 只是 `QMAH.Api/appsettings.json` 與 `QMAH.Web/appsettings.json` 的預設候選與全部候選失敗時的 fallback，不是資料庫必須存在的位置。

`QmahDatabaseConnectionResolver` 在 `QmahDatabaseDiscovery:Enabled` 為 `true` 時，依序檢查設定值、標準 LocalDB `(localdb)\MSSQLLocalDB`、本機預設 SQL Server instance `.`、`sqllocaldb info` 列出的 LocalDB instance，以及 Windows 登錄檔列出的本機 SQL Server instance。

每個候選都透過 `master.sys.databases` 確認名稱為 `QMAH` 且狀態為 `ONLINE`。

找到第一個可用候選後交給 `AddDbContext`。所有候選都不可用時，才回到設定值或預設值。

這是本機 instance 探索，不會掃描網路，也不會自動附加 `.mdf` 或還原 `.bak`。

需要固定目標時，可在 `QMAH.Api/appsettings.Local.json` 與 `QMAH.Web/appsettings.Local.json` 分別覆寫 `QmahDatabase`。兩個主機仍須指向同一個資料庫。

需要停用自動尋找時，加入：

```json
{
  "QmahDatabaseDiscovery": {
    "Enabled": false
  }
}
```

官方參考：

- [ASP.NET Core Configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-10.0)
- [SQL Server Express LocalDB](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb?view=sql-server-ver17)

## 常見啟動問題

前後台切換入口由伺服器讀取站台設定後轉址，元件內不指定主機或連接埠。API 的 `Backend:AdminUrl` 指向管理後台，Web 的 `Frontend:ClientUrl` 指向使用者前台。兩者都支援完整網址與部署子路徑，可在各自的 `appsettings.Local.json` 或環境變數 `Backend__AdminUrl`、`Frontend__ClientUrl` 覆寫。本機預設後台入口為 `http://localhost:5183`，兩種標準啟動 profile 都會監聽此網址；HTTPS profile 會由後台轉至 HTTPS。Angular 前台預設為 `http://localhost:4200`。自訂連接埠、不同主機或部署時須設定實際網址，並確認目標服務已啟動。既有 Local 設定若仍指定 `https://localhost:7039`，只啟動 HTTP 後台時也須改成 HTTP 入口。

切換入口僅轉往固定設定的站台，不讀取管理資料，也不接受使用者提供的任意轉址網址。登入過期時由後台導向登入頁，後台頁面仍檢查 Admin 權限。回到前台的轉址不要求有效票證。前後台在 Development 共用不標記 Secure 的 `.QMAH.Auth` Cookie，支援 HTTP Angular 代理與 HTTPS 後台；正式環境仍一律要求 Secure。開發時的 loopback 轉址保留目前的 `localhost`／`127.0.0.1`／`::1`，避免切換後落到不同 Cookie 主機；Angular 代理改寫 Host 時，使用 loopback Referer 辨識瀏覽器來源。不同部署網域不能只靠同名 Cookie 共用登入；應另外規劃登入流程。確認視窗無法使用時仍可透過原始連結切換。

切換連結保留原有登入機制，不會透過網址傳遞登入票證。前台入口僅對 `Admin` 顯示，API 與後台轉址入口也檢查管理員權限。

### 431 Request Header Fields Too Large

若瀏覽器開啟 `https://localhost:7039` 時顯示 `431 Request Header Fields Too Large`，通常是瀏覽器保留了舊版或重複的 `localhost` Cookie，不是 NuGet 還原或專案載入失敗。

Web 與 API 使用不同的固定 Cookie 名稱，啟動後會清除已知的舊版 QMAH／ASP.NET Core 登入與 Anti-forgery Cookie。只要標頭仍在 Kestrel 可接收的有限範圍內，清理會自動完成，不需要刪除資料庫內容。

若 request 尚未進入應用程式前就再次回傳 431，代表 Cookie 已超過伺服器可解析的上限。關閉本機網站分頁，再從網址列左側的鎖頭開啟網站資料設定，清除 `localhost` 的 Cookie 與網站資料後重新啟動；也可用無痕視窗確認登入頁是否恢復正常。清除後本機登入狀態會消失，需重新登入，但不會刪除資料庫內容。

Cookie 不包含連接埠，因此清除 `localhost` 的網站資料時，不只尋找 `7039`。若仍無法開啟，確認沒有同時保留多個舊的 QMAH Web／API 程序，再重新啟動 `QMAH 全站（API＋前台＋管理後台）` 或需要的局部服務。

### 無法連線或找不到資料表

先確認資料庫名稱為 `QMAH`，再在 SSMS 查看實際連線的 instance 是否存在且為 `ONLINE`。啟動記錄會列出 `QmahDatabaseConnectionResolver` 的候選與選用結果；`(localdb)\MSSQLLocalDB` 只是候選之一。

若只有空資料庫，使用 QMAH-Database `db-v0.12.1` 的 `.bak` 或同版本 `QMAH.sql` 建立；不以 Patch 或 Seed 補齊完整展示資料。

### HTTPS 憑證警告

可先使用 `http` 啟動設定開發。需要 HTTPS 時，依 Visual Studio 提示信任本機開發憑證。

## 本機展示帳號

若要在隔離資料庫重建展示會員，先把根目錄的 `QMAH.DemoCredentials.csv` 複製成未提交的 `QMAH.DemoCredentials.local.csv`，再填妥所有 Password 欄位。

展示資料工具會優先讀取這份根目錄檔案，並在同一位置建立備份。缺少帳號或留白密碼時會直接停止，絕不自動產生隨機密碼。

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

密碼只存在 Repository 外的未提交 credentials 檔案或密碼管理工具。忘記密碼時，使用 `reset-password` 只重設指定的隔離資料庫。

密碼、Cookie、Token 或本機 log 不放進 Git。完整命令見 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html)。

## 開發前的資料與程式界線

### SQL Server 是結構基準

本專案採 DB-first。資料表、欄位、外鍵與約束以 SQL Server Schema 為準；Entity、Fluent mapping 與 `QmahDbContext` 是程式端對照：

```text
SQL Server Schema → Entity／Fluent mapping → QmahDbContext → Controller／Service → ViewModel → View
```

不使用 `Database.Migrate()`、`EnsureCreated()` 或新增 EF Migration，也不只修改 Entity。

需要變更 Schema 時，必須同步檢查 SQL、Entity、DbContext、文件與 QMAH-Database Snapshot。

EF Core 的通用 DB-first 說明見 [Managing Database Schemas](https://learn.microsoft.com/en-us/ef/core/managing-schemas/) 與 [Reverse Engineering](https://learn.microsoft.com/en-us/ef/core/managing-schemas/scaffolding/)。

### DbContext 由 DI 提供

Controller 透過建構式取得 scoped `QmahDbContext`，不重新建立 SQL 連線，也不使用 `new QmahDbContext()`。

一般清單查詢使用 `AsNoTracking()`；表單使用 ViewModel、`ModelState` 與 `[ValidateAntiForgeryToken]`。

查詢、寫入、交易、Identity 與 `RowVersion` 的完整實例見 [資料存取與 DB-first](https://msit173-03.github.io/QMAH-Docs/architecture/data-access.html)。

### 後端、管理後台與使用者前台的界線

目前採三個可獨立啟動的應用程式與一個共用資料層：`QMAH.Web` 專注 Razor 管理後台，`QMAH.Api` 提供 `/api/v1/*`，`QMAH.Client` 提供 Angular 使用者前台。

`QMAH.Infrastructure` 集中 DB-first Entity、`QmahDbContext` 與匯入核心。API 與 Angular 透過 `QMAH.Client/proxy.conf.json` 連接。

Visual Studio 的 `.slnLaunch` 提供 `QMAH 全站（API＋前台＋管理後台）` 複合啟動，也保留 API 單獨啟動、API＋Angular 前台與 API＋管理後台的選項；VS Code 工作區則提供 API＋Angular 的複合啟動。

Angular 不直接連資料庫，也不依賴管理後台的 ViewModel；前台欄位、狀態、權限與錯誤回應以 [REST API 契約](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html) 為準。

## 五個 Area

| Area | 負責內容 | 起始網址 |
| --- | --- | --- |
| `Catalog` | 文物、分類、年代、題庫設定、鑰匙、解鎖 | `/Catalog` |
| `Game` | 房間、玩家、回合、選題、作答、投票 | `/Game` |
| `Social` | 貼文（含官方公告類型）、留言、檢舉、活動、通知 | `/Social` |
| `User` | Identity 帳號、個人資料、地址、會員紀錄 | `/User` |
| `Store` | 商品、購物車、折價券、訂單、付款、點數、庫存 | `/Store` |

各 Area 共用同一個資料庫，但只維護對應的畫面與流程。

讀取其他系統資料時，確認資料責任與歷史紀錄是否允許變更，再決定唯讀查詢或建立明確的跨表 Service。詳細資料界線見 [Area 責任與資料界線](https://msit173-03.github.io/QMAH-Docs/architecture/area-boundaries.html)。

## 文物、題庫與商城商品

三份資料都以 `ArtifactId` 指向同一件文物，不靠名稱或字串拆解比對：

| 資料表 | 保存內容 | 與文物的關係 |
| --- | --- | --- |
| `catalog.Artifacts` | 分類、年代、說明、尺寸、圖片、來源與授權 | 文物主資料 |
| `game.ArtifactQuestionEntries` | 題型、難度、是否可出題 | 每件文物最多一筆題庫設定 |
| `store.Products` | 商品名稱、文案、尺寸、售價、庫存與上架狀態 | 每件文物最多一件商品 |

商城不直接使用來源商城的圖片與售價，因為來源商城素材的開放授權標示不如故宮 Open Data 文物圖片明確。

資料工具會把同一件文物轉成「文物名稱－文物明信片」商品，沿用已標示授權的圖片，另外產生明信片文案、A6 明信片尺寸與依年代、分類計算的示意售價。商品資料可以獨立調整，不會改寫圖鑑與題庫；訂單明細另存成交時的品名與單價快照。

官方公告編輯器的「快速插入」可從目前有效優惠券產生商城活動，也提供展覽、文物導讀、參觀提醒與鑑定遊戲模板；商城以外的內容不會被硬套成優惠文案。社群貼文編輯器共用安全的純文字排版標記（`【小標】`、`• 項目`、`「引用」與分段），前台以共用呈現元件顯示層次，不把 HTML 寫入資料庫。這樣保留既有 `SocialPosts.Content` 契約，也讓官方公告能同時被商城與社群引用。

文物資料的 `LicenseCode`、`SourceUrl` 與 `AttributionText` 必須保留。故宮資料頁未明確標示授權時，不因課程用途就視為可公開使用。

商城商品是課程示意資料，不代表國立故宮博物院官方商品、實際製造品或市場售價。

來源與授權規則見 [資料與圖片使用說明](https://msit173-03.github.io/QMAH-Docs/features/data-and-media.html)；官方資料見 [故宮典藏資料檢索－Open Data](https://digitalarchive.npm.gov.tw/opendata/)。

## 文件入口

正式開發文件保留在 [QMAH-Docs Repository](https://github.com/MSIT173-03/QMAH-Docs)。同一批 Markdown 由 [VitePress 文件站](https://msit173-03.github.io/QMAH-Docs/) 建置。

首頁提供完整循序路線與六個快速查詢頁，固定順序為 Shared、Catalog、Game、Social、User、Store：

| 快速頁 | 直接進入 |
| --- | --- |
| Shared | [共用基礎](https://msit173-03.github.io/QMAH-Docs/quick-reference/shared.html) |
| Catalog | [圖鑑與文物](https://msit173-03.github.io/QMAH-Docs/quick-reference/catalog.html) |
| Game | [遊戲與作答](https://msit173-03.github.io/QMAH-Docs/quick-reference/game.html) |
| Social | [社群與活動](https://msit173-03.github.io/QMAH-Docs/quick-reference/social.html) |
| User | [會員與 Identity](https://msit173-03.github.io/QMAH-Docs/quick-reference/user.html) |
| Store | [商城與訂單](https://msit173-03.github.io/QMAH-Docs/quick-reference/store.html) |

查閱順序：

1. [開發環境與啟動](https://msit173-03.github.io/QMAH-Docs/getting-started/development-environment.html)
2. [開發資料與本機展示](https://msit173-03.github.io/QMAH-Docs/getting-started/development-data.html)
3. [系統架構總覽](https://msit173-03.github.io/QMAH-Docs/architecture/system-overview.html)
4. [Area 責任與資料界線](https://msit173-03.github.io/QMAH-Docs/architecture/area-boundaries.html)
5. [資料表參考](https://msit173-03.github.io/QMAH-Docs/architecture/database-reference.html) 與 [資料存取與 DB-first](https://msit173-03.github.io/QMAH-Docs/architecture/data-access.html)
6. 依系統快速頁進入前端、管理後台、功能與 API 正規文件。
7. 需要精確欄位、HTTP 行為、工具參數或版本交付規則時，查閱 [參考文件](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html)。

## Repository 內入口

- [資料庫責任與 Snapshot 路標](database/README.md)
- [文件入口](docs/README.md)
- [貢獻與協作規則](CONTRIBUTING.md)
- [資料工具入口](tools/QmahDataTools/README.md)
- [QMAH-Database 測試資料工具與 Snapshot](https://github.com/MSIT173-03/QMAH-Database/tree/main/tools/QmahDataTools)
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
├─ QMAH.Client/                    Angular 21.2.23 使用者前台
├─ database/
│  ├─ README.md                    資料庫路標
│  ├─ Schema.sql                   DB-first 結構契約
│  └─ VERSION                      相容 Snapshot tag
├─ docs/README.md                  文件 Repository 路標
├─ tools/QmahDataTools/            共用的文物／商城資料處理工具
├─ CONTRIBUTING.md                 協作規則
└─ README.md
```

Logo 與獨立圖標位於 `QMAH.Media/images/brand/`，favicon 位於 `QMAH.Media/favicon.ico`。直接引用現有檔案，不在各 Area 複製或重新改色。

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

五個 Area 分支都已建立，可依 GitHub 權限直接 Push。功能變更不直接修改 `main` 或 `develop`；整合共同分支時建立 PR 留下變更紀錄。

`main` 禁止 force push 與刪除。`.bak`、bin、obj、log、快取、raw output、`.mdf`、`.ldf` 或大型執行檔不提交進 Repository。

## 小遊戲續玩與每日獎勵

- 每日小遊戲獎勵次數於台灣時間凌晨 00:00 更新，與會員簽到一致。進入單人遊戲頁會查詢今日剩餘次數；額度用完仍可遊玩並保留成績。
- 查看原圖、開啟操作視窗及暫停時不計入評分用時。首次送出後固定本局評分資料，網路失敗重送不會因等待而降低成績。
- 續玩資料核對登入會員；舊版沒有會員欄位的存檔先向伺服器確認所屬會員。多人回答草稿依玩家、房間與回合暫存於同一瀏覽器分頁。
- 新增會員限定的 `GET /api/v1/game/reward-status`（剩餘獎勵次數與更新時間）及 `GET /api/v1/game/attempts/{id}`（確認尚未結算遊戲的所屬會員）。
- 新開局以既有 `Seed` 欄位的 `v3-` 前綴固定評分版本，不接受降級送出。仍以最終盤面與客戶端回報操作資料計分，並非完整的操作歷程防作弊機制。
- 以上沿用既有資料表與欄位，不需資料庫遷移。

## 教育用途與素材權利聲明

本 Repository 為「智慧應用微軟 C# 工程師養成班－MSIT173 期」課程專題，限於課程學習、系統開發、功能測試與專題發表，不提供實際交易服務，也不從事營利、銷售、廣告或商業授權。

文物資料與圖像取自國立故宮博物院 Open Data／典藏資料檢索系統中明確標示的開放內容，依各資料頁所載 CC0 或 CC BY 4.0 條款使用。需要姓名標示的素材，資料庫保存作品名稱、來源網址、授權代碼與 `AttributionText`。

本專題不使用來源商城商品圖片或即時售價。商城展示資料由已授權文物資料產生，不代表國立故宮博物院官方商品、實際製造品或市場售價。素材權利標示、使用範圍或來源資訊需要補正時，透過 Repository Issue 聯繫。
