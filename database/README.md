# QMAH 資料庫還原與版本管理

QMAH 採 SQL Server DB-first。Razor 後台、REST API、匯入工具與 Angular 前台共用同一個資料庫契約。

資料庫 Schema 是資料契約，Entity 與 `QmahDbContext` 只負責對照 SQL Server，不使用 EF Migration，也不建立 `__EFMigrationsHistory`

## 一般開發者只需要兩種還原方式

建立全新本機資料庫時只需要一個最新檔案：優先還原最新 Release 的 `.bak`；不使用二進位備份時，才改執行 Repository 或 Release 提供的同源完整 `.sql`。兩種檔案擇一即可，不需要同時使用，也不需要另外執行 `Schema.sql`、seed 腳本或文物匯入工具。

### 方式一：Release 的 `.bak`

這是最快的方式，適合直接開始開發

1. 開啟 GitHub Repository 的 [Releases](https://github.com/MSIT173-03/QMAH/releases)
2. 在最新版本的 Assets 下載 `QMAH-<version>.bak`
3. 用 SSMS 連線到自己的 SQL Server 或 `(localdb)\MSSQLLocalDB`
4. 在 Databases 按右鍵，選 **Restore Database...**
5. 選 **Device**，加入下載的 `.bak`
6. 資料庫名稱使用 `QMAH`
7. 還原完成後，以 Visual Studio 開啟 `QMAH.sln` 並按 F5

`.bak` 是已驗證的二進位資料庫快照，方便快速取得完整資料庫

### 方式二：完整文字版 `QMAH.sql`

Repository 的 [`QMAH.sql`](QMAH.sql) 是一般組員唯一需要知道的完整 SQL 還原入口

在全新的 SQL Server 上，使用 SSMS 開啟 `QMAH.sql` 後按 **Execute**，單獨執行這一個檔案即可建立目前版本的資料庫、資料表、約束與共同資料

Release 也會附上同一次匯出的 `QMAH-<version>.sql`，內容與 Repository 的 `database/QMAH.sql` 對應同一個 reference database snapshot

執行前請確認目標 SQL Server 上沒有同名的 `QMAH` 資料庫；腳本不會覆蓋既有資料庫

## Release 更新：以最新版完整快照乾淨重建

Repository 不提供也不支援將舊版 `QMAH` 原地更新的資料庫腳本。當 Release 更新 Schema、Entity、題庫／商城資料或匯入規則時，最新版的 `.bak` 與 `database/QMAH.sql` 應該已經是同一份完整快照；一般組員只需要用最新版檔案乾淨還原，不需要自行做增量補資料：

1. 先備份需要保留的個人測試資料，關閉 `QMAH.Web` 與 `QMAH.Api`。
2. 將本機舊版 `QMAH` 移除或改用新的資料庫名稱，再擇一還原最新版 Release `.bak` 或完整執行同版本 `QMAH.sql`。
3. 直接啟動網站，確認資料筆數、Schema、Web 與 API 都與版本說明一致；不需要再執行 `Schema.sql`、seed、`NpmDataImporter` 或其他展示資料命令。

每次遠端版本發布都必須在 Release 說明明確標示「需要以最新版完整檔案重新建立資料庫」、快照版本與資料內容。不要把舊資料庫直接交給新程式，也不要由網站啟動時自動建表或修改 Schema；個人測試資料要自行匯出後再選擇性匯回。`NpmDataImporter`、展示資料工具與 seed 只在資料庫整合者建立下一份 canonical snapshot 前使用，完成驗證後才把結果放進新的 `.bak` 與 `.sql`。

## `.bak` 與 `.sql` 的分工

| 檔案 | 用途 | 是否進 Git Repository |
| --- | --- | --- |
| `database/QMAH.sql` | 可閱讀、可 review、可 diff 的完整還原入口 | 是 |
| `QMAH-<version>.sql` | Release 對應的完整文字版快照 | 僅作 Release Asset |
| `QMAH-<version>.bak` | SQL Server 快速還原用的二進位快照 | 僅作 Release Asset |
| `Schema.sql` | Schema 結構審核與 DB-first 對照來源 | 是 |
| `seed-showcase-data.sql` | 固定 SQL 展示資料的相容性補充；不是一般組員還原後的步驟 | 是 |

Git 可以保存 `.bak`，但無法對二進位內容提供有意義的逐行差異，因此 `.bak` 不作為唯一版本紀錄

`QMAH.sql` 才是可審查的完整文字版；`.bak` 只是讓組員更快取得同一份資料庫

## 完整 SQL 的內容

匯出工具會從同一個 canonical/reference SQL Server database 取得：

- `catalog`、`game`、`social`、`store`、`user` schemas
- `admin` schema 的後台稽核資料表
- 所有非 SSMS 系統表的 QMAH tables
- columns、資料型別、NULL 設定、identity、computed／rowversion 欄位
- primary key、unique constraint、foreign key、index、default、CHECK constraint
- ASP.NET Core Identity tables、roles、demo accounts 及其關聯資料
- `social.MediaAssets` 的社群上傳圖片中繼資料；官方文物圖鑑圖片仍維持原有資料夾與來源規則
- 當時 reference database 中被確認保留的完整 canonical 與展示資料；目前這些資料會直接隨同快照交給所有組員

資料列會以固定欄位順序、固定主鍵排序與不受文化設定影響的格式輸出。Unicode、NULL、bit、decimal、日期時間、GUID、binary 與單引號都會由 exporter 正確序列化；`rowversion` 不會被錯誤地當成一般欄位寫入

SSMS 建立的 `dbo.sysdiagrams` 與 Diagram stored procedures 不屬於 QMAH 資料契約，不會放進完整 SQL 或 Release snapshot

## Repository 內的結構檔案

### `Schema.sql`

只描述資料庫結構，適合審核欄位、主鍵、外鍵、索引、預設值與 CHECK constraint

### `seed-showcase-data.sql`

只補充固定的展示情境，不建立 Schema，也不會由網站啟動時自動執行；腳本具備既有資料判斷，可重複執行。它只供資料庫整合者在產生下一份完整快照前使用，或供個人隔離資料庫維護相容情境；一般組員還原最新快照後不需要執行。

### `QMAH.sql`

由 exporter 從 reference database 產生的完整單檔還原版本，一般組員不需要先執行 `Schema.sql` 或任何 seed 腳本

## 資料庫整合者的匯出流程

需要產生新的 Release 時，在 Repository 根目錄執行：

```powershell
.\tools\QmahDataTools\Export-ReferenceDatabase.ps1 -Version 0.6.0
```

工具會依序完成：

1. 建置匯出與驗證工具
2. 確認 canonical database 存在並建立隔離備份
3. 在暫時 LocalDB instance 還原同一份 snapshot
4. 排除 SSMS Diagram 系統物件並掃描明顯的測試佔位資料
5. 建立 `.bak` 並執行 `RESTORE VERIFYONLY WITH CHECKSUM`
6. 連續匯出兩次 SQL，確認內容 byte-for-byte 一致
7. 只使用完整 SQL 在新的資料庫重建
8. 比較 source／rebuilt database 的 metadata、row count 與每表 SHA-256 hash
9. 驗證 `QmahDbContext`、Entities 與 `QMAH.Web` 啟動
10. 更新 `database/QMAH.sql`，並產生 Release 用 `.bak`、`.sql` 與 `SHA256SUMS.txt`

輸出位置：

```text
_工具輸出/reference-database/<version>/
```

`.bak`、暫存資料庫檔、log、parity report 與其他產物都只放在 `_工具輸出`，不提交到 Git

## 目前版本的定位

目前的 `database/QMAH.sql` 與本機驗證輸出的 `0.6.0` 快照是同一份完整 reference database snapshot，包含目前已確認的共同展示資料。GitHub Release 發布時，Release 的 `.bak` 與 `.sql` 必須沿用這份快照；它仍不宣稱已涵蓋尚未實作的前台功能資料。

其他 Area 合併新的 table、column、index、foreign key、constraint、Identity 初始化或共同資料後，不需要重寫工具，只需：

1. 完成功能整合並更新 canonical database
2. 重新執行同一支 `Export-ReferenceDatabase.ps1`
3. 通過 SQL-only 重建與 parity validation
4. 以新的版本號發布同源的 `.bak` 與 `.sql`

若某筆資料無法判定是共同資料或個人測試資料，匯出流程不會自行刪除；需由資料庫整合者依文件、seed、reference DB 與 Area 負責人確認後再決定資料邊界

## Schema 變更規則

資料表、欄位、索引、外鍵、constraint 或跨 Area 關聯需要變更時：

1. 先在 PR 說明資料庫影響範圍
2. 更新 SQL Server 與 `Schema.sql`
3. 重新核對 Entity 與 `QmahDbContext`
4. 重新執行完整匯出與 parity validation
5. 通過驗證後才建立新的 Release

不要只修改 Entity，也不要在 `Program.cs` 呼叫 `EnsureCreated()` 或 `Migrate()`
