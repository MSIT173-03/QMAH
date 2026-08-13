# QMAH SQL Server 資料庫流程

## DB-first 定義

QMAH 採 SQL Server DB-first。

DB-first 的意思是：資料庫 Schema、欄位、索引、外鍵與 Identity 表先定案，程式再依照這份契約存取資料。

實際資料列永遠存在 SQL Server。

Entity 檔案不保存資料；它只是程式執行時代表資料列的 C# 類別。

`QmahDbContext` 也不會把資料放在 Entity 裡面。

它只負責把 LINQ 查詢、寫入與 SQL Server 資料表連接起來。

Microsoft 對「資料庫 Schema 是來源」的做法稱為 Reverse Engineering：從既有資料庫核對或產生 `DbContext` 與 Entity。

參考 Microsoft 官方文件：

- [Managing Database Schemas](https://learn.microsoft.com/en-us/ef/core/managing-schemas/)
- [Reverse Engineering](https://learn.microsoft.com/en-us/ef/core/managing-schemas/scaffolding/)

本專案不使用 EF Migration，也不建立 `__EFMigrationsHistory`。第一版空白結構由 `Schema.sql` 建立；SQL Server 資料庫是唯一 Schema 來源。

## 目前的整合結果

資料庫整合的責任範圍如下：

- SQL Server Schema、ERD 與 `database/Schema.sql` 的定案。
- Entity／`QmahDbContext` 與實際 Schema 的對照。
- 經驗證的參考 `.bak` 與 Release 附件。
- 正式文物／商品匯入前的 Schema 檢查與資料包預檢。

一般功能開發不建立資料庫、不修改 Schema、不產生 EF Migration，也不執行正式資料匯入命令。

需要變更資料表時，提交欄位、索引、外鍵、原因與受影響功能；資料庫整合流程會同步更新 SQL／ERD、對照模型、文件與參考資料庫。

## 開發環境建立：還原 `.bak`

從 GitHub Repository 右側的 **Releases** 開啟最新版本，在 **Assets** 下載參考 `.bak`，再在 SSMS 完成一次還原：

1. 開啟 SQL Server Management Studio（SSMS）。
2. 連線到本機 SQL Server／LocalDB；預設連線名稱是 `(localdb)\MSSQLLocalDB`。
3. 在 **Databases** 按右鍵，選 **Restore Database...**。
4. 選 **Device**，加入 Release 提供的 `.bak`。
5. 資料庫名稱使用 `QMAH`。
6. 在 **Files** 頁確認資料檔與記錄檔路徑是本機可寫入的位置。
7. 按 **OK** 完成還原。

還原完成後，連線字串已符合 [`QMAH.Web/appsettings.json`](../QMAH.Web/appsettings.json) 的預設值。

還原完成後，以 Visual Studio 開啟 `QMAH.sln`，選擇 `https` 或 `http` 啟動設定並按 **F5**。

網站會使用還原好的 SQL Server 資料庫，不會自動建表，也不會自動修改 Schema。

如果電腦使用 SQL Server Developer，而不是 LocalDB，複製 `QMAH.Web/appsettings.Local.example.json` 為未提交的 `QMAH.Web/appsettings.Local.json`，再覆蓋 `QmahDatabase` 即可；網站啟動時會自動讀取該檔案，不需要改動 Entity 或 `QmahDbContext`。

## Schema 審核與實機順序

目前 Repository 不放本機資料庫、SSMS Diagram 或 `.bak`。

目前的驗證順序是：

1. SQL／ERD／Identity 表的結構審核。
2. Entity／`QmahDbContext` 對照與 EF Core 模型檢查。
3. `Schema.sql` 與空白 SQL Server 的實機驗證。
4. 五個 Area 的 CRUD 與跨表流程驗證。

以上項目均已在同一個 `QMAH` 資料庫完成。參考 `.bak` 不附帶 SSMS Diagram；需要看關聯時，再依 [`Diagram-Guide.md`](Diagram-Guide.md) 在自己的資料庫建立閱讀用圖表即可。已建立並以 `RESTORE VERIFYONLY` 驗證 Release 參考 `.bak`。

Diagram 與 `.bak` 是驗證完成後的閱讀／還原產物，不反過來決定 Schema。

## 建立新的參考 `.bak`

資料更新與驗證完成後，在 Repository 根目錄執行：

```powershell
.\tools\QmahDataTools\Export-ReferenceDatabase.ps1
```

工具會從 `(localdb)\MSSQLLocalDB` 的 `QMAH` 建立帶時間戳記的新 `.bak`，輸出至工作區根目錄 `_工具輸出\reference-database`，並自動執行 `RESTORE VERIFYONLY`。備份通過驗證後上傳至 GitHub Release；`.bak` 本身不進 Repository。

## 共同資料與本機測試資料

文物、題庫設定、商品與各 Area 展示情境是共同基準資料，隨 Release 的參考 `.bak` 提供。參考資料庫目前包含 256 件文物、256 筆題庫設定、256 件商品、49 筆社群貼文、49 筆留言、10 個遊戲房間、19 位房間玩家，以及 12 組商城訂單／付款紀錄，方便各 Area 直接開發列表、詳情、篩選與 CRUD。

如果要在另一個已完成正式資料與 Identity 初始化的資料庫補上相同情境，可執行 [`seed-showcase-data.sql`](seed-showcase-data.sql)。腳本只新增社群、遊戲與商城展示資料，不會改動 Schema，也不會在網站啟動時自動執行；各區段會辨識既有資料，不會重複灌入。

各 Area 開發時可以在自己的 LocalDB 新增、修改、刪除測試資料。只有要調整資料表、欄位、外鍵、索引、約束或跨 Area 關係時，才需要走整合流程。完整邊界請看[共同資料與開發測試資料](../docs/02-development-data.md)。

## Entity／`QmahDbContext` 對照基準

目前已核對：

- 33 個業務 Entity／`DbSet`。
- `IdentityDbContext` 提供 `ApplicationUser` 與 7 張 Identity 資料表。
- `QmahDbContext` 對應 SQL Server 的 40 張專案資料表；`dbo.sysdiagrams` 是 SSMS 自行建立的 Diagram 系統表，不是 QMAH 業務資料。
- 資料表、欄位、資料型別、nullability、主鍵、索引、外鍵與 CHECK constraint 都以 SQL Server Schema／ERD 為準。
- Entity 與 Fluent mapping 只保留 EF Core 在查詢、寫入與關聯操作需要的對照。CHECK constraint 由 SQL Server 執行，不在 Fluent mapping 重複寫一份。
- 不使用 `dotnet ef migrations` 建立、套用或檢查 Schema。

實機資料庫建立後，需要再次核對時，使用 `dotnet ef dbcontext scaffold` 產生暫存對照檔。檢查結果放在 `_工具輸出`，不直接覆蓋 Repository 內的 Entity。

## 結構變更規則

1. 先提出資料表、欄位、索引、外鍵與原因。
2. 更新 SQL Server Schema／ERD 與審核用 SQL。
3. 使用 EF Core Scaffold 重新核對 Entity 與 `QmahDbContext`，再同步必要的程式端對照。
4. 更新 `Schema.sql` 後，在空白資料庫重跑並核對 Entity／`QmahDbContext`；不建立 EF Migration。
5. 在空白測試資料庫驗證腳本，再提供新的參考 `.bak`。

不要直接手寫 `AspNetUsers`／`AspNetRoles` 的帳號資料。

帳號與角色初始化統一走 `UserManager`／`RoleManager`。

## 檔案邊界

`.bak`、`.mdf`、`.ldf`、本機資料庫、Diagram、raw JSON、下載圖片、快取、log、`bin`、`obj` 與大型執行檔不進 Repository。

工具輸出一律放在工作區根目錄的 `_工具輸出`。
