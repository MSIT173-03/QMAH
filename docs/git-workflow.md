# Git 與 GitHub 協作手冊

QMAH 使用單一 Public Repository。五個 Area 各使用固定 feature branch，完成可驗證階段後整合至 `develop`；展示或發布版本由 `develop` 合併至 `main`。

Repository：<https://github.com/MSIT173-03/QMAH>

## 權限怎麼運作

加入 `MSIT173-03` 組織不會自動取得此 Repository 的 `Write` 權限。目前先以 `Read` 為預設；需要直接 Push 自己的 feature branch 時，請由 Repository 管理員另外授予 `Write`。

加入組織後可以 Clone、Pull、建立 Pull Request 與檢視 GitHub Actions。取得此 Repository 的 `Write` 權限後，才可以直接 Push 自己的 `feature/*` 分支。

日常 Push 不需要 Owner 逐次核准。`Write` 不包含刪除 Repository、修改敏感設定或管理組織的權限。

若加入組織後仍無法 Clone 或 Push，先確認 GitHub 組織邀請已接受，而且 Visual Studio 登入的是同一個帳號。

## Branch Protection

Repository 採 Public，以使用 GitHub Free 組織的 Branch Protection。保護只套用共同分支，不影響 feature branch 的日常 Push。

目前設定：

| 分支 | Pull Request | 人工核准 | 必要檢查 |
| --- | --- | --- | --- |
| `main` | 可選，大改動建議使用 | 不需要 | `Build` |
| `develop` | 可選，大改動建議使用 | 不需要 | `Build` |

`main` 禁止 force push 與刪除。PR 不是每次變更的必要條件；小型修正或同步可以直接 Push，較大的功能、共用檔案或需要討論的變更再開 PR 留下紀錄。`Build` 仍是共同分支的必要檢查。

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

一般功能仍應在自己的 `feature/<area>` 分支開發；只有小型同步、文件修正或團隊已同意的簡單變更，才直接 Push 到 `main` 或 `develop`。

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
Pull → 修改 → 本機驗證 → Commit → Push
```

開始前：

1. 確認目前位於自己的 feature branch。
2. Pull 遠端同分支。
3. 如果要同步目前最新版展示內容，先取得 `origin/main`；如果只是跟進團隊整合進度，再依通知使用 `origin/develop`。
4. 再開始修改。

完成一個可驗證階段後：

1. 在 Git Changes 逐一查看變更。
2. 確認沒有密碼、個人設定、raw、快取、`bin`、`obj` 或 `.bak`。
3. 本機建置並操作受影響頁面。
4. Commit、Push 自己的 feature branch。
5. 小型變更到此即可；如果是大改動、共用檔案或需要留下討論紀錄，再建立 `feature/<area> → develop` 的 Pull Request。

期中或期末展示前，可建立 `develop → main` Pull Request 留下展示版本紀錄；確認 Build 通過後即可合併，不要求人工核准。

## Visual Studio：保留自己的修改並同步最新 main

不要在還有一堆「未認可變更」時直接切換分支或 Pull。最安全的方式是先把目前進度 Commit 到自己的分支，再把最新版 `main` 合併進來。同步 `main` 通常不會刪掉自己的程式，真正需要小心的是不要讓未提交的修改被切換或衝突流程弄亂。

Microsoft 官方也有完整的 [Fetch、Pull、Push 與 Sync 教學](https://learn.microsoft.com/en-us/visualstudio/version-control/git-fetch-pull-sync?view=vs-2022)、[Visual Studio Git Repository 與分支合併教學](https://learn.microsoft.com/en-us/visualstudio/version-control/git-manage-repository?view=vs-2022)，以下只列 QMAH 這個專案實際要用的流程。

### 正常做法：Commit 後合併 `origin/main`

1. 看 Visual Studio 右下角的分支名稱，確認目前在自己的功能分支，例如：

   ```text
   feature/game
   feature/catalog
   feature/social
   feature/store
   feature/user
   ```

   不要在 `main` 上直接開發。也可以開啟 **Git → 管理分支**，或 **檢視 → Git 存放庫** 確認目前分支。

2. 開啟 **檢視 → Git 變更**，確認檔案都是自己這次修改的內容，輸入 Commit 訊息，例如「完成會員查詢頁初版」，再按 **認可全部**（Commit All）。功能還沒完成也可以先 Commit，這只是把進度安全存進自己的分支。

3. 建議按 **推送**（Push），先把自己的分支備份到 GitHub。

4. 選擇 **Git → 擷取**（Fetch）。Fetch 只取得遠端最新資訊，不會立刻修改目前檔案。

5. 保持在自己的功能分支，不要切到 `main`。開啟 **檢視 → Git 存放庫**，展開 **遠端 → origin**，對 `origin/main` 按右鍵，選 **合併至目前分支**（Merge into Current Branch）。這代表保留自己的分支，再把 `main` 的最新修改加進來，不是把自己的分支換成 `main`。

6. 完成合併後執行 **建置 → 建置方案**，確認沒有編譯錯誤，再回到 **檢視 → Git 變更**，Commit 這次合併結果並 Push 自己的分支。

最簡單的順序：

```text
確認在自己的功能分支
→ Commit 自己的修改
→ Push 備份
→ Fetch
→ 將 origin/main 合併至目前分支
→ 處理衝突
→ Build
→ Commit 並 Push
```

### 如果出現衝突

如果自己和 `main` 修改的是不同檔案，Git 通常會直接合併。只有雙方修改同一個檔案的同一個位置，才需要人工處理。

Visual Studio 會在 Git 變更中顯示衝突檔案，通常可以看到：

- 目前內容：自己的分支版本
- 傳入內容：`main` 的版本
- 合併結果：最後要留下的內容

不要對所有檔案直接選「全部接受目前」或「全部接受傳入」，要逐段確認哪些是自己的功能、哪些是 `main` 的更新。可以只保留其中一邊，也可以保留兩邊再手動整理。處理完成後，將檔案標示為已解決，再建立合併 Commit。

需要畫面操作時，直接參考 Microsoft 的[在 Visual Studio 解決合併衝突教學](https://learn.microsoft.com/en-us/visualstudio/version-control/git-resolve-conflicts?view=visualstudio)。

### 特別檢查 `_ViewStart.cshtml`

同步後確認自己負責的 Area 仍有：

```text
Areas/<你的Area>/Views/_ViewStart.cshtml
```

內容應該是：

```cshtml
@{
    Layout = "/Views/Shared/Admin/_AdminLayout.cshtml";
}
```

不要刪掉這個檔案，也不要用自己的舊檔案覆蓋最新版。Scaffold 產生的 View 如果包含：

```cshtml
Layout = null;
```

也要移除，不然會蓋掉 `_ViewStart.cshtml`。

### 真的不想處理衝突時：外部備份法

如果真的不想處理 Git 衝突，可以先把自己寫好的檔案複製到 Repository 外面，再從最新版 `main` 建立一個乾淨的新功能分支，最後把自己的檔案放回去。

1. 在 Repository 外建立備份資料夾，例如 `桌面/QMAH-我的功能備份`。
2. 複製自己新增或修改的檔案，保留原本的資料夾結構，例如：

   ```text
   Areas/<你的Area>/Controllers
   Areas/<你的Area>/ViewModels
   Areas/<你的Area>/Views/<你的功能>
   ```

3. 即使已經複製出去，原本分支仍建議先 Commit 並 Push，這樣 GitHub 上還有一份可以救回來的版本。
4. 在 Visual Studio 執行 **Git → 擷取**。
5. 從最新的 `origin/main` 建立新的功能分支，例如 `feature/user-rebuild` 或 `feature/game-rebuild`。先不要刪除原本的分支。
6. 只把真正修改的 Controller、ViewModel、View 和相關檔案放回正確位置，再執行 Build。
7. 不要直接用整個舊 Area 覆蓋新版，也不要用舊的 `_ViewStart.cshtml` 覆蓋最新版，避免蓋掉別人的修改或移除共用後台設定。
8. 確認功能正常後，再 Commit 和 Push 新分支。

這個方法比較容易理解，但可能漏檔或蓋掉新版內容。正常情況仍優先使用 Merge，真的不想處理衝突時才使用外部備份法。

### 最新外觀套版方法

後台共用模板、`_ViewStart.cshtml`、Tabler CRUD class 與手機版操作方式，請看 Discord 的[最新外觀套版方法](https://discord.com/channels/1526757626241618031/1526757626719764555/1537676235075752066)。

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
