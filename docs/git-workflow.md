# Git 與 GitHub 協作手冊

QMAH 使用單一 Public Repository。五個 Area 各使用固定 feature branch，完成可驗證階段後整合至 `develop`；展示或發布版本由 `develop` 合併至 `main`。

Repository：<https://github.com/MSIT173-03/QMAH>

## 權限怎麼運作

加入 `MSIT173-03` 組織不會自動取得此 Repository 的 `Write` 權限。目前先以 `Read` 為預設；需要直接 Push 自己的 feature branch 時，請由 Repository 管理員另外授予 `Write`。

加入組織後可以：

- Clone Repository。
- Pull 所有分支。
- 直接 Push 自己的 `feature/*` 分支。
- 建立 Pull Request。
- 檢視 GitHub Actions 結果。

日常 Push 不需要 Owner 逐次核准。`Write` 不包含刪除 Repository、修改敏感設定或管理組織的權限。

若加入組織後仍無法 Clone 或 Push，先確認 GitHub 組織邀請已接受，而且 Visual Studio 登入的是同一個帳號。

## Branch Protection

Repository 採 Public，以使用 GitHub Free 組織的 Branch Protection。保護只套用共同分支，不影響 feature branch 的日常 Push。

目前設定：

| 分支 | Pull Request | 人工核准 | 必要檢查 |
| --- | --- | --- | --- |
| `main` | 必須 | 任一位協作者 1 人 | `Build` |
| `develop` | 必須 | 不需要 | `Build` |

`main` 禁止 force push 與刪除，並要求 PR 討論已解決。`main` 的一人核准不必固定由 Owner 執行；Owner 保留緊急管理權限，但日常整合仍依 PR 流程。

## 分支用途

| 分支 | 用途 |
| --- | --- |
| `main` | 可展示、可發布的整合版本 |
| `develop` | 已整合、待展示驗證的共同版本 |
| `feature/game` | 遊戲模組 |
| `feature/catalog` | 圖鑑模組 |
| `feature/social` | 社群模組 |
| `feature/user` | 會員模組 |
| `feature/store` | 商城模組 |

一般功能不要直接在 `main` 或 `develop` 修改。

## 第一次 Clone

在 Visual Studio 選擇 **Clone a repository**：

1. 輸入 `https://github.com/MSIT173-03/QMAH.git`。
2. 選擇本機資料夾並完成 Clone。
3. 開啟 `QMAH.sln`。
4. 在 Git 分支選單切到自己負責的 Area 分支。
5. 依 README 從 Release 還原 `QMAH-<version>.bak`，或執行 `database/QMAH.sql`。

Visual Studio 檔案旁的藍色鎖通常表示「檔案目前沒有本機修改」，不是唯讀，也不代表沒有權限。

## 每次開始與結束

```text
Pull → 修改 → 本機驗證 → Commit → Push → Pull Request → develop
```

開始前：

1. 確認目前位於自己的 feature branch。
2. Pull 遠端同分支。
3. 取得 `develop` 最近已整合的內容並處理衝突。
4. 再開始修改。

完成一個可驗證階段後：

1. 在 Git Changes 逐一查看變更。
2. 確認沒有密碼、個人設定、raw、快取、`bin`、`obj` 或 `.bak`。
3. 本機建置並操作受影響頁面。
4. Commit、Push 自己的 feature branch。
5. 建立 `feature/<area> → develop` 的 Pull Request。

期中或期末展示前，建立 `develop → main` Pull Request，確認 Build 通過並完成 1 人核准後再合併。

## Commit

一個 Commit 對應一項容易理解的改動：

```text
feat(catalog): 新增文物清單頁面
fix(store): 修正購物車數量驗證
docs: 補充資料庫還原步驟
refactor(game): 整理回合作答查詢
```

不要每改一行就 Commit，也不要把互不相關的數日工作塞進同一筆 Commit。

共同開發已開始後，不再清除 Git 歷史。不要使用 force push、`git reset --hard` 覆蓋共同分支，也不要刪除別人的 Commit。

## Pull Request

PR 要寫清楚：

- 做了什麼功能或修正。
- 影響哪個 Area、網址與資料表。
- 如何操作與驗證。
- 是否修改共用檔案。
- 是否影響 Schema、資料或圖片。
- 尚未完成或已知限制。

建立 PR 後，GitHub Actions 會自動執行：

```powershell
dotnet restore QMAH.sln --locked-mode
dotnet build QMAH.sln --no-restore --configuration Release
```

`Build` 失敗時先查看 Log 並修正，再合併。工作流程不會部署網站，也不會連線或修改 QMAH 資料庫。

## 共用檔案與 CODEOWNERS

下列檔案會同時影響多個模組：

- `QMAH.Web/Program.cs`
- `QMAH.Web/Data/`
- `QMAH.Web/Models/Entities/` 與 `Models/Identity/`
- `database/`
- `QMAH.Web/Views/Shared/`
- `QMAH.Web/wwwroot/css/site.css` 與 `wwwroot/js/site.js`
- `QMAH.Web/QMAH.Web.csproj` 與 `packages.lock.json`
- `.github/`、README 與共同文件

修改前先在群組說明目的與影響範圍。CODEOWNERS 只會自動通知檢視，不會讓每一次 feature Push 都等待 Owner。

## 資料庫變更

一般功能分支不要：

- 建立 EF Migration 或 `__EFMigrationsHistory`。
- 呼叫 `EnsureCreated()` 或 `Migrate()`。
- 自行建立另一套資料庫或 schema。
- 只改 Entity，卻沒有確認 SQL Server 欄位。

需要調整 Schema 時，在 PR 或群組列出欄位名稱、型別、是否允許 `NULL`、預設值、索引／外鍵與受影響功能，再由資料庫整合流程同步 `Schema.sql`、`database/QMAH.sql`、Entity、DbContext、Diagram 與同版本 Release `.sql`／`.bak`。

## 衝突處理

不要直接選「全部保留目前版本」或「全部採用傳入版本」。先理解雙方改動目的，再保留仍需要的內容。

`QmahDbContext`、Entity、`Schema.sql`、`Program.cs`、共用 Layout 或套件鎖定檔發生衝突時，先確認雙方修改目的與資料契約，解決後重新建置並測試。

## 合併前檢查

- 專案可成功建置。
- 修改的網址可開啟。
- 正常輸入、錯誤輸入與空資料都檢查過。
- 瀏覽器 Console 沒有未處理錯誤。
- 沒有提交密碼、個人設定、快取或建置產物。
- PR 已列出共用檔案與資料庫影響。
- GitHub Actions `Build` 成功。

環境問題請看[開發環境與共用套件](01-development-environment.md)；資料存取請看[QmahDbContext 使用方式](07-dbcontext-usage.md)。
