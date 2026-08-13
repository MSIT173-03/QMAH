# QMAH 協作規則

本專案採單一 ASP.NET Core MVC Solution、五個 Area 與共用 SQL Server 資料庫。資料庫採 DB-first：SQL Server Schema 是資料契約，Entity 與 `QmahDbContext` 依資料庫對照；Repository 不使用 EF Migration。

## 開始前

1. 接受 `MSIT173-03` 組織邀請，並確認 Repository 權限為 `Write`。組織成員預設可能只有 `Read`，無法 Push 時請先確認權限。
2. 以最新遠端內容重新 Clone 或更新本機工作目錄。
3. 開啟 `QMAH.sln`，切到自己的 Area 分支，按 **F5** 確認網站可啟動。
4. 從最新 Release 還原 `QMAH-<version>.bak`，或在 SSMS 執行 `database/QMAH.sql`；再於 `appsettings.Local.json` 設定自己的資料庫連線。
5. 依序閱讀 README、`docs/01-development-environment.md`、`docs/02-development-data.md`、`docs/03-area-development-checklist.md`、`docs/04-backend-start-guide.md`、`docs/07-dbcontext-usage.md` 與自己 Area 的資料表關係。

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

日常功能在自己的 `feature/<area>` 分支完成。一般流程是 `feature/<area> → develop → main`。`main` 需要 Pull Request、Build 與一位協作者核准；`develop` 需要 Pull Request 與 Build，不需要人工核准。feature branch 可直接 Push，但不要直接修改其他 Area 的 branch。

## 檔案放置原則

- Area 的 Controller、ViewModel 與 Razor View 放在 `QMAH.Web/Areas/<Area>/`。
- 每一個新增或修改表單使用對應的 ViewModel；不要直接把 Entity 當 POST 表單模型。
- 單表 CRUD 可直接由 Controller 注入 `QmahDbContext`。跨表交易、外部服務、長流程或重複規則，才在該 Area 建立用途明確的 Service。
- `(Services)`、`(Models/Api)`、Area 專用 CSS、Area 專用 JavaScript 與 Partial View 都是可選結構；出現實際需求才建立。
- `Data/`、`Program.cs`、`Models/Identity/`、`database/`、共用 Layout、`wwwroot` 的共用檔案、NuGet 套件與 README 是共同範圍。修改前先在群組說明影響。

完整檔案結構範例見 [架構與資料存取規則](docs/08-architecture-and-data-access.md)。

## 資料庫規則

- 不建立 EF Migration、`__EFMigrationsHistory`、第二套 schema 或另一個 QMAH 資料庫。
- 不呼叫 `EnsureCreated()` 或 `Migrate()`。
- 不只改 Entity 而未確認 SQL Server Schema。
- 欄位、外鍵、索引、CHECK、預設值或跨 Area 關係需要變更時，先列出影響範圍，再同步 Schema、Entity、DbContext、文件與 Release `.bak`。
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
