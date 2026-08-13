# 開發環境與共用套件

這裡集中說明 QMAH 的開發環境、資料庫還原、NuGet 套件、Hot Reload 與 CRUD Scaffold。

完成資料庫還原後，可直接用 Visual Studio 開啟方案並按 `F5`，不需要先執行命令列。

## 共同版本

| 類型                           |     版本 | 用途                                     |
| ------------------------------ | -------: | ---------------------------------------- |
| .NET SDK                       | 10.0.301 | 編譯與執行 ASP.NET Core MVC              |
| ASP.NET Core／Target Framework |  .NET 10 | MVC、Razor、Identity 與網站主機          |
| EF Core SQL Server             |  10.0.10 | 查詢及寫入既有 SQL Server 資料表         |
| EF Core Identity               |  10.0.10 | 帳號、角色、登入與 Token                 |
| EF Core Design／Tools          |  10.0.10 | DB-first 對照與 Visual Studio 工具支援   |
| MVC Code Generation Design     |   10.0.2 | 產生 CRUD Controller 與 View 起始碼      |
| Bootstrap                      |    5.3.8 | 排版與互動元件                           |
| jQuery                         |    3.7.1 | 既有 Razor 表單與簡單互動                |
| jQuery Validation              |   1.22.1 | 用戶端欄位驗證                           |
| jQuery Validation Unobtrusive  |    4.0.0 | ASP.NET Core Model Validation 的前端橋接 |

[`global.json`](../global.json) 固定 .NET SDK 基準，[`.vsconfig`](../.vsconfig) 指定 Visual Studio 的 **ASP.NET and web development** 工作負載。

## 新電腦準備

### Visual Studio

安裝 Visual Studio 2022，並包含 **ASP.NET and web development** 工作負載。

Clone Repository 後開啟 `QMAH.sln`。若本機缺少工作負載，Visual Studio 會依 `.vsconfig` 顯示提示。

### SQL Server 與 SSMS

一般開發可使用 Visual Studio 隨附的 LocalDB：

```text
(localdb)\MSSQLLocalDB
```

需要完整 SQL Server 功能時，也可以使用 SQL Server Developer。兩者都需要 SSMS 來還原參考 `.bak`、執行完整 `database/QMAH.sql` 與查看 Diagram。

### 參考資料庫

從 [最新 GitHub Release](https://github.com/MSIT173-03/QMAH/releases/latest) 下載該版本附帶的 `QMAH-<version>.bak`。若不使用二進位備份，也可直接執行 Repository 的 [`database/QMAH.sql`](../database/QMAH.sql)。

在 SSMS：

1. 連線到要使用的 SQL Server instance。
2. 對 **Databases** 按右鍵，選 **Restore Database...**。
3. Source 選 **Device**，加入 `.bak`。
4. Destination database 使用 `QMAH`。
5. 在 **Files** 頁確認資料檔案路徑可寫入。
6. 按 **OK** 完成還原。

還原後應能看到 `catalog`、`game`、`social`、`store`、`user` 五個 schema。若只有系統資料表或看不到這些 schema，代表還原目標或連線 instance 不正確。

## 啟動網站

Visual Studio 提供三個啟動設定：

| 設定                  | 用途                     | 網址／行為                              |
| --------------------- | ------------------------ | --------------------------------------- |
| `https`               | 一般開發，建議優先使用   | `https://localhost:7039`，同時保留 HTTP |
| `http`                | 本機 HTTP 測試           | `http://localhost:5183`                 |

選擇 `https` 或 `http` 後按 `F5`。可先檢查 `/Game`、`/Social`、`/Catalog`、`/User` 與 `/Store` 是否都能開啟。

網站啟動時不會建立資料庫、不會建表、不會塞測試資料，也不會套用 Migration。若缺少必要 Schema，請先確認是否已還原正確的 Release `.bak`，或完整執行 `database/QMAH.sql`。

## 連線字串

預設連線位於 `QMAH.Web/appsettings.json`：

```json
{
  "ConnectionStrings": {
    "QmahDatabase": "Server=(localdb)\\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False"
  }
}
```

使用 SQL Server Developer 或不同 instance 時：

1. 複製 `QMAH.Web/appsettings.Local.example.json`。
2. 將副本命名為 `QMAH.Web/appsettings.Local.json`。
3. 修改副本中的 `QmahDatabase`。

`Program.cs` 會在其他設定之後讀取 `appsettings.Local.json`，因此本機值會覆蓋預設連線。這個檔案已被 Git 忽略，不要強制加入版控。

不要把個人主機名稱、SQL 帳號、密碼或正式環境連線字串寫進 `appsettings.json`。

`MultipleActiveResultSets` 固定為 `False`。QMAH 沒有同一連線同時讀取多個結果集的需求；微軟也說明 MARS 與 EF Core 交易儲存點不相容，因此不應自行改成 `True`。[Using Transactions](https://learn.microsoft.com/en-us/ef/core/saving/transactions#savepoints)

## 開發資料

參考 `.bak` 與完整 `database/QMAH.sql` 都包含資料庫結構、共同文物資料與畫面開發所需的情境資料。完成其中一種還原方式後，即可在本機 LocalDB 建立、修改與刪除 CRUD 測試資料，不需要執行 Seed 命令。

不同資料庫副本的測試資料可以不同；共同契約是 Schema。新增或修改資料表、欄位、外鍵、索引、約束或跨 Area 關係時，依資料庫結構變更流程處理。詳細原則見[共同資料與開發測試資料](02-development-data.md)。

## NuGet 如何保持一致

所有直接相依版本寫在 `QMAH.Web.csproj`，完整相依解析結果由 `QMAH.Web/packages.lock.json` 固定。

NuGet 套件會下載到各 Windows 使用者的本機快取；專案實際還原版本由 `.csproj` 與鎖定檔決定。NuGet 快取不進 Repository，也不需要手動逐一選擇版本。

NuGet 清單中的「可轉移套件」是 transitive package 的介面翻譯，意思是某個直接套件自動帶入的間接相依，例如 EF Core SQL Server 會帶入 `Microsoft.Data.SqlClient`。它不是需要手動轉移給其他人的套件，也不應逐一加入 `.csproj`；只有需要固定安全修補版本時才例外明列。

Visual Studio 在開啟、還原或建置方案時會自動處理 NuGet。不要在 NuGet 管理視窗執行 **Update All**；共用版本由獨立變更統一更新並驗證鎖定檔。

> **微軟官方做法：** `PackageReference` 把直接相依套件寫在專案檔；鎖定檔則可讓還原結果保持一致。本專案已設定 `RestorePackagesWithLockFile`，所以 Clone 後由 Visual Studio 還原即可，不需要把每台電腦的套件快取提交到 Git。[Package references in project files](https://learn.microsoft.com/en-us/nuget/consume-packages/package-references-in-project-files#locking-dependencies)

需要檢查鎖定還原時，使用：

```powershell
dotnet restore QMAH.sln --locked-mode
```

如果鎖定還原失敗，先確認 `.csproj` 與 `packages.lock.json` 是否由同一個變更一起提交，不要直接刪除鎖定檔。

## 已安裝的互補套件

| 套件               |    版本 | 適用情況                     | 使用邊界                              |
| ------------------ | ------: | ---------------------------- | ------------------------------------- |
| Dapper             |  2.1.79 | 報表、統計、複雜唯讀 SQL     | 不取代一般 CRUD 與 Identity           |
| CsvHelper          |  33.1.0 | CSV 匯入／匯出               | 先定義欄位格式與錯誤處理              |
| ClosedXML          | 0.105.1 | Excel 匯入／匯出與格式化報表 | 大量資料仍要注意記憶體使用            |

三個套件各自處理不同需求：Dapper 補充複雜唯讀 SQL，CsvHelper 處理 CSV，ClosedXML 處理 Excel。某個 Area 不使用時不需要額外設定，也不會自動改變網站行為。

目前不預裝另一套驗證或記錄框架。一般表單使用 Data Annotations／`ModelState`，記錄使用 ASP.NET Core 內建 `ILogger<T>`；真的出現跨多欄位的共用驗證或集中式 Log 需求時，再選定一套工具，避免同一件事同時有兩種寫法。

第三方登入尚未定案，因此目前不預先安裝 Google 或 Microsoft 驗證套件，也不變更資料庫。Identity 既有的 `user.AspNetUserLogins` 已保留標準外部登入對應；確定採用時再加入套件、設定與登入流程即可。完整原則請看 [`external-login.md`](external-login.md)。

## Visual Studio CRUD Scaffold

單一資料表的後台 CRUD 可由 Visual Studio 產生起始碼：

1. 在目標 Area 的 `Controllers` 資料夾按右鍵。
2. 選 **新增** → **新增 Scaffold 項目**。
3. 選 **使用 Entity Framework 的 MVC 控制器與檢視**。
4. Model class 選既有 Entity。
5. Data context class 選 `QmahDbContext`。
6. 確認輸出位置仍在正確的 Area。

產生後要檢查：

- Controller 是否保留 `[Area("...")]`。
- View 路徑與導覽連結是否包含正確 `asp-area`。
- POST 是否只接收允許修改的欄位。
- 下拉選單是否重新載入，ModelState 錯誤時能否正常回畫面。
- 是否誤用 `_db.Update()` 覆蓋整筆 Entity。
- 是否直接對 Identity、付款、點數、庫存或歷史紀錄產生刪除功能。

Scaffold 適合加快基本頁面製作，不等於功能已完成。

從最基礎清單、Scaffold 修正到完整新增、編輯與刪除範例，請看[從清單到完整 CRUD](05-crud-tutorial.md)。

Scaffold 不只有一次產生完整 CRUD。也可以建立 Empty MVC Controller、從 Action 逐頁新增 View、直接建立 Razor View／Partial View，或使用 `dotnet-aspnet-codegenerator`。各方法與 MVC Razor View／Razor Pages 的差異見[Visual Studio Scaffold 操作教學](06-scaffolding-guide.md)。

> **微軟官方工具：** ASP.NET Core MVC 官方教學本身就示範以 Scaffolding 產生 EF Core CRUD 起始碼。產生後仍要依實際欄位、授權與商業規則調整，因此 QMAH 只把它當作起點。[ASP.NET Core MVC with EF Core](https://learn.microsoft.com/en-us/aspnet/core/data/ef-mvc/intro?view=aspnetcore-10.0)

## 可選的開發輔助工具

下列工具是為了減少重複輸入，不是額外的架構要求。沒有使用也能依文件正常開發。

| 工具 | 何時使用 | QMAH 的用法 |
| --- | --- | --- |
| Visual Studio MVC Scaffold | 要先做單表 CRUD 的起始頁面 | 產生 Controller 與 View 後，改成 Area 的 ViewModel、補授權與商業規則 |
| Visual Studio Hot Reload | 正在調整 Razor、CSS、JavaScript | 保持網站啟動，不必每次改字樣或樣式都重開 |
| EF Core Power Tools（選用） | SQL Server Schema 調整後，想用 Visual Studio 介面檢查 Scaffold 結果 | 只對暫存輸出做 Reverse Engineer 比對，不直接覆蓋目前的 Entity 或 `QmahDbContext` |
| Visual Studio Rename／Extract Method | 類別、欄位或重複程式碼需要整理 | 使用 IDE 重構功能，不要手動多檔搜尋取代 |

`Microsoft.VisualStudio.Web.CodeGeneration.Design`、`dotnet-aspnet-codegenerator` 與 `dotnet-ef` 已經隨專案固定版本。EF Core Power Tools 是微軟文件列出的 Visual Studio 擴充工具，可提供 Reverse Engineering 與模型視覺化；它不是 EF Core 專案的一部分，安裝前仍要確認 Visual Studio 與 EF Core 10 相容。[EF Core Tools & Extensions](https://learn.microsoft.com/en-us/ef/core/extensions/)

所有 Scaffold 與 Reverse Engineering 都先輸出到 `_工具輸出` 或暫存資料夾檢查。這樣可以驗證產生結果，卻不會把半成品 Controller、View 或 Entity 混進共同分支。

## Hot Reload 與前端開發

QMAH 是 ASP.NET Core MVC 網站，必須由 ASP.NET Core 主機執行 Controller、Razor、Identity 與資料庫連線。因此不使用 Live Server。

啟動網站後，可使用 Visual Studio Hot Reload 處理多數 Razor、CSS 與 JavaScript 修改。若變更下列內容，通常需要停止後重新啟動：

- `Program.cs` 的服務或 Middleware 設定。
- Entity、`QmahDbContext` 與泛型型別結構。
- 專案參考與 NuGet 套件。
- Hot Reload 顯示不支援的程式碼變更。

不要加入 Razor Runtime Compilation。此專案以 .NET 10 的 Hot Reload 為日常開發方式。

在 Visual Studio 以 **F5** 或 **Ctrl+F5** 啟動後，修改 `.cshtml` 會觸發瀏覽器重新整理，CSS 也可直接套用。若需要從命令列取得相同效果，可執行：

```powershell
dotnet watch --project QMAH.Web
```

兩個啟動設定檔已在 `Properties/launchSettings.json` 開啟 `hotReloadEnabled`。Visual Studio 的「儲存檔案時套用 Hot Reload」屬於個人 IDE 選項，無法由 Repository 強制設定；需要時可在 `工具 → 選項 → 偵錯 → .NET／C++ Hot Reload` 開啟。使用 `dotnet watch` 時，檔案儲存會由檔案監看器觸發 Hot Reload 或瀏覽器重新整理。

不另外安裝 Live Server。它只能預覽靜態 HTML，無法執行 MVC Controller、Razor、Identity 或資料庫查詢。Visual Studio 的舊版 Web Live Preview 主要面向 ASP.NET Framework，也不作為本專案的共同依賴；需要同時檢查多個瀏覽器時，使用 Visual Studio 的 **Browse With**／Browser Link 即可。

> **微軟官方建議：** Razor Runtime Compilation 在 .NET 10 已標示 obsolete，官方建議開發時改用 Hot Reload。Live Server 只提供靜態檔案伺服器，也無法代替 ASP.NET Core 主機。[Razor runtime compilation is obsolete](https://learn.microsoft.com/en-us/aspnet/core/breaking-changes/10/razor-runtime-compilation-obsolete?view=aspnetcore-10.0)

## 本機工具

根目錄的 `dotnet-tools.json` 固定兩項整合維護工具：

| 工具                          |    版本 | 用途                                      |
| ----------------------------- | ------: | ----------------------------------------- |
| `dotnet-ef`                   | 10.0.10 | DB-first 對照與整合檢查；不建立 Migration |
| `dotnet-aspnet-codegenerator` |  10.0.2 | Visual Studio Scaffold 的命令列替代方案   |

一般開發不需要還原這兩項工具。執行命令列 Scaffold 或 EF Core 對照時才使用：

```powershell
dotnet tool restore
```

## 常見問題

### Visual Studio 顯示黃色警告或套件缺失

先在 Solution 上按右鍵選 **Restore NuGet Packages**，再重新建置。仍失敗時確認使用的 .NET SDK 是否符合 `global.json`。

### 無法連線到 LocalDB

確認連線 Server 是 `(localdb)\MSSQLLocalDB`，並在 SSMS 使用同一個 Server 測試。Visual Studio 與 SSMS 連到不同 instance，是最常見原因。

### 網站能啟動，但顯示資料表不存在

通常是資料庫名稱不是 `QMAH`、連錯 instance，或只建立空資料庫而沒有還原 `.bak`／執行完整 `database/QMAH.sql`。先在 SSMS 展開 Tables，確認五個 schema 的資料表存在。

### HTTPS 憑證警告

可先使用 `http` 啟動設定開發。需要 HTTPS 時，再依 Visual Studio 提示信任本機開發憑證。

### Scaffold 找不到 Entity 或 DbContext

先確認方案可以成功建置，且 `Microsoft.VisualStudio.Web.CodeGeneration.Design` 已還原。關閉 Scaffold 視窗、重新建置後再開一次。

### 每個檔案旁邊的藍色鎖

這通常是 Visual Studio 的原始檔控制狀態圖示，表示檔案目前沒有本機修改，不代表檔案被 Windows 鎖定，也不影響編輯。實際修改後圖示會隨 Git 狀態改變。

## 開始開發前檢查

- Visual Studio 使用正確工作負載與 .NET SDK。
- SSMS 已還原 `QMAH`，五個 schema 都存在。
- `https` 或 `http` 可以啟動。
- 五個 Area 首頁可以開啟。
- NuGet 沒有未還原警告。
- 個人連線只寫在 `appsettings.Local.json` 或 User Secrets。
- 沒有建立 Migration、空白資料庫或第二套 Schema。

資料存取寫法請接著閱讀 [`07-dbcontext-usage.md`](07-dbcontext-usage.md)，Razor 與前端檔案安排請看 [`10-frontend-guide.md`](10-frontend-guide.md)。
