# QMAH 資料庫還原與版本管理

QMAH 採 SQL Server DB-first

資料庫 Schema 是資料契約，Entity 與 `QmahDbContext` 只負責對照 SQL Server，不使用 EF Migration，也不建立 `__EFMigrationsHistory`

## 一般開發者只需要兩種還原方式

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

## `.bak` 與 `.sql` 的分工

| 檔案 | 用途 | 是否進 Git Repository |
| --- | --- | --- |
| `database/QMAH.sql` | 可閱讀、可 review、可 diff 的完整還原入口 | 是 |
| `QMAH-<version>.sql` | Release 對應的完整文字版快照 | 僅作 Release Asset |
| `QMAH-<version>.bak` | SQL Server 快速還原用的二進位快照 | 僅作 Release Asset |
| `Schema.sql` | Schema 結構審核與 DB-first 對照來源 | 是 |
| `seed-showcase-data.sql` | 特定展示資料的可重複補充腳本 | 是 |

Git 可以保存 `.bak`，但無法對二進位內容提供有意義的逐行差異，因此 `.bak` 不作為唯一版本紀錄

`QMAH.sql` 才是可審查的完整文字版；`.bak` 只是讓組員更快取得同一份資料庫

## 完整 SQL 的內容

匯出工具會從同一個 canonical/reference SQL Server database 取得：

- `catalog`、`game`、`social`、`store`、`user` schemas
- 所有非 SSMS 系統表的 QMAH tables
- columns、資料型別、NULL 設定、identity、computed／rowversion 欄位
- primary key、unique constraint、foreign key、index、default、CHECK constraint
- ASP.NET Core Identity tables、roles、demo accounts 及其關聯資料
- 當時 reference database 中被確認保留的 canonical 與展示資料

資料列會以固定欄位順序、固定主鍵排序與不受文化設定影響的格式輸出。Unicode、NULL、bit、decimal、日期時間、GUID、binary 與單引號都會由 exporter 正確序列化；`rowversion` 不會被錯誤地當成一般欄位寫入

SSMS 建立的 `dbo.sysdiagrams` 與 Diagram stored procedures 不屬於 QMAH 資料契約，不會放進完整 SQL 或 Release snapshot

## Repository 內的結構檔案

### `Schema.sql`

只描述資料庫結構，適合審核欄位、主鍵、外鍵、索引、預設值與 CHECK constraint

### `seed-showcase-data.sql`

只補充特定展示情境，不建立 Schema，也不會由網站啟動時自動執行；腳本具備既有資料判斷，可重複執行

### `QMAH.sql`

由 exporter 從 reference database 產生的完整單檔還原版本，一般組員不需要先執行 `Schema.sql` 或任何 seed 腳本

## 資料庫整合者的匯出流程

需要產生新的 Release 時，在 Repository 根目錄執行：

```powershell
.\tools\QmahDataTools\Export-ReferenceDatabase.ps1 -Version 0.3.0
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

目前的 `database/QMAH.sql` 與最新 Release 只代表這個 Repository commit 對應的 reference database snapshot，不宣稱是所有 Area 功能整合完成後的期中最終資料庫

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
