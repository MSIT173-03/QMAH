# QMAH 協作規則

本專案採單一 .NET Solution，包含 Razor MVC 後台、獨立 REST API、五個 Area、Angular 前台骨架與共用 SQL Server 資料庫。資料庫採 DB-first：SQL Server Schema 是資料契約，Entity 與 `QmahDbContext` 依資料庫對照；Repository 不使用 EF Migration。

## 開始前

1. 接受 `MSIT173-03` 組織邀請，並確認 Repository 權限為 `Write`。組織成員預設可能只有 `Read`，無法 Push 時請先確認權限。
2. 以最新遠端內容重新 Clone 或更新本機工作目錄。
3. 從最新 Release 還原 `QMAH-<version>.bak`，或在 SSMS 執行 `database/QMAH.sql`；再於 `appsettings.Local.json` 設定自己的資料庫連線。
4. 開啟 `QMAH.sln`，切到自己的 Area 分支，按 **F5** 確認網站可啟動。
5. 依序閱讀 README、`docs/01-development-environment.md`、`docs/02-development-data.md`、`docs/03-area-development-checklist.md`、`docs/04-backend-start-guide.md`、`docs/07-dbcontext-usage.md`、`docs/10-frontend-guide.md`、`docs/11-tabler-admin-guide.md`、`docs/12-frontend-start-guide.md`、`docs/13-rest-api.md`、`docs/14-catalog-import.md`、`docs/15-local-showcase-and-credentials.md` 與所負責 Area 的資料表關係。

一般功能開發不需要命令列，也不需要建立資料表。

## 分支與工作範圍

| 分支 | 負責範圍 |
| --- | --- |
| `main` | 可展示、可發布的整合版本 |
| `develop` | 已整合、待展示驗證的共同版本 |
| `feature/game` | 遊戲 |
| `feature/catalog` | 圖鑑 |
| `feature/social` | 社群 |
| `feature/user` | 會員 |
| `feature/store` | 商城 |

日常功能在自己的 `feature/<area>` 分支完成。一般流程是 `feature/<area> → develop → main`。`main` 需要 Pull Request、手動執行的 Build 與一位協作者核准；`develop` 需要 Pull Request 與手動執行的 Build，不需要人工核准。feature branch 可直接 Push，但不要直接修改其他 Area 的 branch。

## 檔案放置原則

- Area 的 Controller、ViewModel 與 Razor View 放在 `QMAH.Web/Areas/<Area>/`。
- DB-first Entity、Identity Model 與 `QmahDbContext` 統一保留在 `QMAH.Infrastructure/`；不要搬進 Area，也不要在 `QMAH.Web`、`QMAH.Api` 或各工具複製一份。
- 每一個新增或修改表單使用對應的 ViewModel；不要直接把 Entity 當 POST 表單模型。
- QMAH 新增 MVC 功能時，Controller 一律使用 Entity 的單數名稱加上 `Controller`，View 資料夾直接使用同一個 Entity 名稱。例如 `ArtifactCategory` 對應 `ArtifactCategoryController` 與 `Views/ArtifactCategory`；不要自行改成 `ArtifactCategoriesController` 或 `Views/ArtifactCategories`。
- MVC 的 View 資料夾名稱等於 Controller 類別名稱去掉最後的 `Controller`。Controller、View 資料夾、`asp-controller` 與網址中的 Controller 名稱必須完全一致。
- Visual Studio 的 Add View 視窗可能把 Area View 產生到根 `Views/<Entity>`，且該視窗沒有輸出目錄選項。不要重新命名產生的資料夾；直接把整個資料夾移到 `Areas/<Area>/Views/<Entity>`，再 Build。
- `DbSet` 與 SQL 資料表維持 DB-first 現有名稱，不跟著 MVC 名稱修改。例如 Controller 是 `ArtifactCategoryController`，查詢仍然使用 `_db.ArtifactCategories`，SQL 對應仍然是 `catalog.ArtifactCategories`。
- 單表 CRUD 可直接由 Controller 注入 `QmahDbContext`。跨表交易、外部服務、長流程或重複規則，才在該 Area 建立用途明確的 Service。
- `(Services)`、`(Models/Api)`、Area 專用 CSS、Area 專用 JavaScript 與 Partial View 都是可選結構；出現實際需求才建立。
- `QMAH.Infrastructure/Data/`、`QMAH.Infrastructure/Models/Identity/`、兩個 ASP.NET Core 主機的 `Program.cs`、`database/`、共用 Layout、`wwwroot` 的共用檔案、NuGet 套件與 README 是共同範圍。修改前先在群組說明影響。

完整檔案結構範例見 [架構與資料存取規則](docs/08-architecture-and-data-access.md)。

## 資料庫規則

- 不建立 EF Migration、`__EFMigrationsHistory`、第二套 schema 或另一個供開發使用的 QMAH 資料庫；Release 驗證流程產生的暫時資料庫除外，流程結束後會清理。
- 不呼叫 `EnsureCreated()` 或 `Migrate()`。
- 不只改 Entity 而未確認 SQL Server Schema。
- 欄位、外鍵、索引、CHECK、預設值或跨 Area 關係需要變更時，先列出影響範圍，再同步 Schema、Entity、DbContext、文件與同版本 Release `.sql`／`.bak`。
- 每次新的 reference database 版本都必須由同一次驗證流程產生 `database/QMAH.sql`、Release `.sql` 與 Release `.bak`；不可分別手動維護兩種快照。
- 一般 CRUD 可以新增、修改或刪除測試資料；只有 Schema 改動需要走資料庫整合流程。

## Commit、Push 與 Pull Request

一個 Commit 處理一項可理解的改動，主旨寫出 Area 與內容：

```text
feat(catalog): 新增文物清單頁面
fix(store): 修正購物車數量驗證
docs: 補充資料庫還原步驟
```

Push 前逐一確認 Git Changes，避免提交密碼、個人連線設定、raw、快取、log、`bin`、`obj`、大型 EXE 或 `.bak`。資料工具產出只放工作區根目錄 `_工具輸出`，不納入 Repository。

Push 前先確認本機建置成功。Pull Request 請寫明：修改功能、Area、網址、使用的資料表、驗證方式、共同檔案影響，以及 Schema／資料／圖片是否變動。資料庫整合 PR 另需附 parity report 或說明輸出位置。合併前確認 GitHub Actions `Build` 成功。

不要 force push、清除共同歷史、刪除其他人的 Commit，或未經討論改動共同檔案。分支、權限與衝突處理細節見 [Git 與 GitHub 協作手冊](docs/git-workflow.md)。
