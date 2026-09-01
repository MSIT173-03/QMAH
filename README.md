<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo.svg">
    <img src="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg" width="560" alt="清明鑑定屋 QMAH — Qing Ming Appraisal House">
  </picture>
</p>

<p align="center">
  以故宮開放資料為基礎，整合圖鑑、鑑定遊戲、社群、會員與商城的 ASP.NET Core MVC 專題
</p>

<p align="center">
  <a href="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml"><img src="https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://github.com/MSIT173-03/QMAH/releases/latest"><img src="https://img.shields.io/github/v/release/MSIT173-03/QMAH?display_name=tag" alt="Release"></a>
  <img src="https://img.shields.io/badge/.NET-10.0-512BD4" alt=".NET 10">
  <img src="https://img.shields.io/badge/SQL%20Server-DB--first-315E55" alt="SQL Server DB-first">
</p>

## 專案簡介

QMAH 是 **Qing Ming Appraisal House（清明鑑定屋）** 的縮寫

網站以文物圖像為共同核心，讓使用者查看圖鑑、參與多人鑑定遊戲、交流觀察，並瀏覽文物衍生的縮小複製品商品。五個 Area 位於同一個 Solution，共用一個 `QMAH` SQL Server 資料庫、ASP.NET Core Identity 與網站基礎

這個 Repository 是五人共同開發的整合基線，已整理到可以開始製作 Angular 前台的狀態。目前已備妥：

- SQL Server Schema、Entity 對照與 `QmahDbContext`
- ASP.NET Core Identity 資料表、Cookie 登入與角色授權
- 256 件文物、256 筆題庫設定、256 件對應商城商品，以及各 Area 可直接使用的共同資料
- 8 個文物分類、網站圖片、資料處理工具，以及可用 `.sql` 或 `.bak` 取得的參考資料庫
- Game、Catalog、Social、User、Store 五個 Area 的既有 Razor 後台與可延伸的管理頁
- `/api/v1/*` REST API、DTO、分頁、ProblemDetails、Cookie 驗證與開發用 OpenAPI／Scalar
- 管理員可使用的文物資料 Preview → Import 流程；題庫預設同步，商城同步由管理員選擇
- `QMAH.Client` Angular 21.2.22 前台骨架、API proxy、VS Code 擴充套件自動安裝設定與前台交接文件
- DB-first、資料存取、前端、展示資料、匯入工具與 Git 協作文件

目前的工作重點是以既有 API 與資料契約開始製作前台畫面；Razor 後台仍可獨立維護，正式金流與完整多人遊戲互動則依各 Area 的既有範圍持續擴充。

Angular 目前固定在 21.2.22。課堂要求使用 Angular 21，因此保留同一個 major version；原本的 21.1.3 相依樹在本機安全檢查會列出漏洞，升到 21.2.22 後已通過 `npm audit --audit-level=high`。這次只更新 Angular 21 內的修補與次版本，不升到 22，既有 standalone、Router、HttpClient 與 SCSS 寫法不需要改寫。版本與 Node／TypeScript 相容範圍請看[前台開發起點](docs/12-frontend-start-guide.md)。

## 開始開發

不需要執行 Migration，也不需要自己建立資料表。建立本機資料庫時，從下列兩種方式擇一即可；兩者都是同一版本的完整 reference database，不需要兩種都執行

**方式一：還原 Release 的 `.bak`**

1. 開啟 Repository 右側的 [最新 Release](https://github.com/MSIT173-03/QMAH/releases/latest)，在 **Assets** 下載 `QMAH-<version>.bak`
2. 在 SSMS 連線 `(localdb)\MSSQLLocalDB`
3. 選擇 **Restore Database...** → **Device**，將資料庫名稱設為 `QMAH`

**方式二：直接執行完整 `.sql`**

在 SSMS 開啟 Repository 的 [`database/QMAH.sql`](database/QMAH.sql) 並執行即可；最新 Release 也會附上同一次匯出的 `QMAH-<version>.sql`

完成其中一種方式後：

4. 用 Visual Studio 開啟 `QMAH.sln`，等待 NuGet 自動還原。
5. 在啟動設定選擇 `QMAH 後端（API＋Razor）`，按 `F5`；Razor 後台使用 `https://localhost:7039`，REST API 使用 `https://localhost:7249`。
6. 若使用 VS Code，可開啟 Repository 根目錄，在 **Run and Debug** 選 `QMAH 前台開發（API＋Angular）`；它會啟動 API 與 Angular。只修改 Razor 後台時，也可以直接使用 `QMAH.Web` 的 `https` 啟動設定。
7. 需要手動啟動 Angular 前台時，在另一個終端機執行：

   ```powershell
   cd QMAH.Client
   npm ci
   npm start
   ```

   瀏覽器開啟 `http://localhost:4200/`；前台的 `/api`、`/openapi` 與 `/scalar` 會透過 `proxy.conf.json` 轉送到 `https://localhost:7249`。

`.bak` 與 `.sql` 包含該版本 reference database 的資料表、索引、外鍵、Identity，以及目前完整的共同展示資料；目前快照已包含 336 篇貼文、768 筆留言、208 筆訂單、298 筆訂單明細與 96 筆商品評價。組員完成其中一種還原後即可開始開發，不需要再執行 Schema、seed、資料匯入或展示資料工具。`QmahDatabaseRelease generate-showcase-data` 與 seed 腳本只由資料庫整合者在產生下一份完整快照前使用，或供個人隔離資料庫重建展示情境；它們不是組員還原後的增量步驟。SSMS Diagram 不屬於資料庫契約，也不包含在 Release 還原內容內。

不論使用 `.bak` 或 `.sql`，都不需要先執行 `Schema.sql` 或 seed 腳本。兩種方式的完整差異與資料庫整合流程請看[資料庫還原與版本管理](database/README.md)

若 Visual Studio、LocalDB、NuGet 或 Scaffold 尚未準備好，請先看[開發環境與共用套件](docs/01-development-environment.md)

### 常見啟動問題：431 Request Header Fields Too Large

如果瀏覽器開啟 `https://localhost:7039` 時顯示 `431 Request Header Fields Too Large`，通常是瀏覽器保留了舊版或重複的 `localhost` Cookie，並非 NuGet 還原或專案載入失敗。Web 與 API 現在使用不同的固定 Cookie 名稱，啟動後會清除已知的舊版 QMAH／ASP.NET Core 登入與 Anti-forgery Cookie；只要標頭仍在 Kestrel 可接收的有限範圍內，這個清理會自動完成，不需要刪除資料庫內容。

如果瀏覽器在 request 尚未進入應用程式前就再次回傳 431，代表 Cookie 已超過伺服器可解析的上限，中介軟體沒有機會送出刪除指令。此時請先關閉本機網站分頁，再從網址列左側的鎖頭開啟網站資料設定，清除 `localhost` 的 Cookie 與網站資料後重新啟動；也可以先用無痕視窗確認登入頁是否恢復正常。清除後本機登入狀態會消失，需要重新登入，但不會刪除資料庫內容。

Cookie 不包含連接埠，因此請清除 `localhost` 的網站資料，不要只尋找 `7039`。若仍無法開啟，請確認沒有同時保留多個舊的 QMAH Web／API 程序，再重新啟動 Visual Studio 的 `QMAH 後端（API＋Razor）` 設定。

### 本機展示帳密

若要在自己的資料庫重建展示會員，先把根目錄的 `QMAH.DemoCredentials.csv` 複製成 `QMAH.DemoCredentials.local.csv`，再填妥所有 Password 欄位。展示資料工具會優先讀取這份根目錄檔案，並在同一位置建立備份；缺少帳號或留白密碼時會直接停止，絕不自動產生隨機密碼。`.local.csv` 與備份檔已排除在 Git 外，請不要提交。完整命令與帳號用途請看[本機展示與帳號](docs/15-local-showcase-and-credentials.md)。

## 開發前先知道

### SQL Server 是結構基準

本專案採 DB-first。資料表、欄位、外鍵與約束以 SQL Server Schema 為準；Entity、Fluent mapping 與 `QmahDbContext` 是程式端對照

```text
SQL Server Schema → Entity／Fluent mapping → QmahDbContext → Controller／Service → ViewModel → View
```

不要使用 `Database.Migrate()`、`EnsureCreated()` 或新增 EF Migration，也不要只修改 Entity。需要變更 Schema 時，必須同步檢查 SQL、Entity、DbContext、文件與參考備份

### DbContext 由 DI 提供

Controller 透過建構式取得 scoped `QmahDbContext`，不要自行建立 SQL 連線，也不要使用 `new QmahDbContext()`

一般清單查詢使用 `AsNoTracking()`；表單使用 ViewModel、`ModelState` 與 `[ValidateAntiForgeryToken]`。新增、修改、交易、Identity 與 `RowVersion` 的專案實例都在[QmahDbContext 使用方式](docs/07-dbcontext-usage.md)

### 資料存取維持可追蹤

單一資料表 CRUD 可由 Controller 直接使用 `QmahDbContext`。Razor View 與 POST 表單使用 ViewModel，不直接綁定 Entity

跨表交易、外部服務、較長的狀態流程、重複呼叫或需要獨立測試的規則，建立用途明確的 Service。這是 QMAH 目前的團隊規則，不代表所有 ASP.NET Core 專案都必須採用相同分層

QMAH 不採「每張表一個 Wrapper」或 Generic Repository。只有 Wrapper 能封裝 Entity 本身無法表達、而且必須集中維護的行為時才建立；單純轉送屬性只會增加轉換與除錯位置。完整界線請看[架構與資料存取規則](docs/08-architecture-and-data-access.md)

### 後端與前台的專案邊界

目前採三個可獨立啟動的應用程式與一個共用資料層：`QMAH.Web` 專注 Razor 後台，`QMAH.Api` 提供 `/api/v1/*`，`QMAH.Client` 提供 Angular 前台；`QMAH.Infrastructure` 集中 DB-first Entity、`QmahDbContext` 與匯入核心，避免兩個主機各自維護一份資料模型。API 與 Angular 透過 `QMAH.Client/proxy.conf.json` 連接，Visual Studio 的 `.slnLaunch` 已預設同時啟動 API 與 Razor 後台，VS Code 工作區則提供 API＋Angular 的複合啟動。這個邊界保留共用資料庫與 Cookie／Identity 契約，同時讓 API 能獨立部署與測試。

## 五個 Area

| Area | 負責內容 | 起始網址 |
| --- | --- | --- |
| `Game` | 房間、玩家、回合、選題、作答、投票 | `/Game` |
| `Catalog` | 文物、分類、年代、題庫設定、鑰匙、解鎖 | `/Catalog` |
| `Social` | 貼文（含官方公告類型）、留言、檢舉、活動、通知 | `/Social` |
| `User` | Identity 帳號、個人資料、地址、會員紀錄 | `/User` |
| `Store` | 商品、購物車、折價券、訂單、付款、點數、庫存 | `/Store` |

各 Area 共用同一個資料庫，但只維護自己負責的畫面與流程。要讀取其他模組資料時，先確認資料責任與歷史紀錄是否允許變更，再決定直接查詢或抽成 Service

## 文物、題庫與商城商品

三份資料都以 `ArtifactId` 指向同一件文物，不靠名稱或字串拆解比對

| 資料表 | 保存內容 | 與文物的關係 |
| --- | --- | --- |
| `catalog.Artifacts` | 分類、年代、說明、尺寸、圖片、來源與授權 | 文物主資料 |
| `game.ArtifactQuestionEntries` | 題型、難度、是否可出題 | 每件文物最多一筆題庫設定 |
| `store.Products` | 商品名稱、文案、尺寸、售價、庫存與上架狀態 | 每件文物最多一件商品 |

商城不直接使用來源商城的圖片與售價，原因是其開放授權標示不如故宮 Open Data 文物圖片明確。資料工具會把同一件文物轉成「文物名稱－縮小複製品」商品，沿用已標示授權的圖片，另外產生商品文案、二分之一尺寸與依年代、分類計算的示意售價

商品資料可以獨立調整，不會改寫圖鑑與題庫。訂單明細另存成交時的品名與單價快照，商品後續修改或下架也不會破壞歷史訂單。來源、授權、尺寸與價格規則請看[資料與圖片使用說明](docs/data-and-media.md)

## 文件入口

以下順序是建議的閱讀順序。根目錄 `README.md` 是 Repository 首頁，資料庫與工具則保留在各自資料夾的入口文件。

| 順序 | 開發階段 | 文件 |
| ---: | --- | --- |
| 01 | 準備 Visual Studio、LocalDB、NuGet 與 Hot Reload | [開發環境與共用套件](docs/01-development-environment.md) |
| 02 | 查看共同資料、測試資料、資料表筆數與狀態值 | [開發資料與參考資料庫](docs/02-development-data.md) |
| 03 | 確認五個 Area 的責任、資料與開發界線 | [Area 開發檢查](docs/03-area-development-checklist.md) |
| 04 | 了解後台功能的開發順序 | [後台開發起點](docs/04-backend-start-guide.md) |
| 05 | 從 List 完成 Details、Create、Edit、Delete | [從清單到完整 CRUD](docs/05-crud-tutorial.md) |
| 06 | 使用 Visual Studio 或 CLI 產生 CRUD 起始檔案 | [Scaffold 操作教學](docs/06-scaffolding-guide.md) |
| 07 | 使用 `QmahDbContext` 查詢、新增、修改、刪除與交易 | [QmahDbContext 使用方式](docs/07-dbcontext-usage.md) |
| 08 | 判斷 Entity、ViewModel、DTO、Service 與 Wrapper 的界線 | [架構與資料存取規則](docs/08-architecture-and-data-access.md) |
| 09 | 實作 Identity 登入、登出、角色與會員 CRUD | [Identity 與會員資料管理](docs/09-midterm-identity.md) |
| 10 | 撰寫 Razor、表單、CSS、JavaScript 與響應式畫面 | [Razor 與前端開發](docs/10-frontend-guide.md) |
| 11 | 使用 Tabler 共用骨架與元件製作各系統後台頁面 | [Tabler 後台實作指南](docs/11-tabler-admin-guide.md) |
| 12 | 啟動 Angular 前台與開始串接 API | [前台開發起點](docs/12-frontend-start-guide.md) |
| 13 | 查閱 REST API、DTO、分頁與驗證規則 | [REST API 契約](docs/13-rest-api.md) |
| 14 | 操作管理員文物資料匯入與同步 | [文物資料匯入](docs/14-catalog-import.md) |
| 15 | 建立本機展示資料與管理測試帳號 | [本機展示資料與帳號](docs/15-local-showcase-and-credentials.md) |
| 16 | 查閱 API 專業用語與文件文字規範 | [API 名詞表](docs/16-api-glossary.md) |
| 17 | 管理本機圖片、物件儲存與 CDN 交付 | [媒體交付設定](docs/17-media-delivery.md) |

參考文件：

- [文物資料、圖片授權與商品產生](docs/data-and-media.md)
- [Git 與 GitHub 協作](docs/git-workflow.md)
- [日後加入 Google 或 Microsoft 登入](docs/external-login.md)

其他入口：

- [資料庫說明、完整 `.sql` 與 `.bak` 還原](database/README.md)
- [SSMS Diagram 操作](database/Diagram-Guide.md)
- [QMAH 資料處理工具](tools/QmahDataTools/README.md)
- [共同協作規則](CONTRIBUTING.md)

## Repository 結構

```text
QMAH/
├─ QMAH.sln
├─ QMAH.DemoCredentials.csv      展示帳密空白範本
├─ QMAH.Api/                    REST API 主機
├─ QMAH.Infrastructure/         DB-first Entity、DbContext 與匯入核心
├─ QMAH.Web/
│  ├─ Areas/                     五個功能模組
│  ├─ Controllers/               Razor 後台與共用網站頁面
│  ├─ Models/                    後台 ViewModel
│  ├─ Views/                     共用 Razor View
│  └─ wwwroot/                   樣式、腳本、套件、圖片與品牌素材
├─ QMAH.Client/                  Angular 21.2.22 前台（獨立啟動）
├─ database/                     QMAH.sql、Schema.sql、seed 腳本與 Diagram 說明
├─ docs/                         01–17 核心開發與交付文件；其餘為參考與選用文件
├─ tools/QmahDataTools/          可重現的資料處理工具
├─ CONTRIBUTING.md               協作規則
└─ README.md
```

Logo、獨立圖標與 favicon 位於 `QMAH.Web/wwwroot/images/brand/`。請直接引用現有檔案，不要在各 Area 複製或重新改色

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

五個 Area 分支都已建立，可直接 Push，不需要逐次核准。組員原則上不要直接修改 `main` 或 `develop`；整合共同分支時建立 PR 留下變更紀錄，但不要求人工核准。Owner 只在確認沒有其他提交的純同步情況下直接快轉分支

不要直接在 `main` 開發，也不要把 `.bak`、`bin`、`obj`、log、快取、raw output、`.mdf`、`.ldf` 或大型執行檔提交進 Repository

## 教育用途與素材權利聲明

本 Repository 為「智慧應用微軟 C# 工程師養成班－MSIT173 期」課程專題，僅用於課程學習、系統開發、功能測試與專題發表，不提供實際交易服務，也不從事營利、銷售、廣告或商業授權

文物資料與圖像取自國立故宮博物院 Open Data／典藏資料檢索系統中明確標示的開放內容，依各資料頁所載 CC0 或 CC BY 4.0 條款使用。需要姓名標示的素材，資料庫已保存作品名稱、來源網址、授權代碼與 `AttributionText`

本專題不使用來源商城商品圖片或即時售價。商城展示資料由已授權文物資料產生，不代表國立故宮博物院官方商品、實際製造品或市場售價。若素材權利標示、使用範圍或來源資訊需要補正，請透過 Repository Issue 聯繫
