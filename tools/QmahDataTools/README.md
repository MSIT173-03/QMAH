# QMAH 資料處理工具

本目錄保存文物資料收集、標準化、商品產生、匯入預檢與資料庫 Release 匯出工具

一般網站開發不需要執行本目錄的資料處理工具。建立本機資料庫時，從 GitHub Release 還原同版本 `.bak`，或直接執行 Repository 的 `database/QMAH.sql`（Release 也提供同源的 `.sql`）即可，兩種方式擇一即可

## 工具分類

| 工具 | 用途 |
| --- | --- |
| `NpmArtifactPipeline` | 收集故宮文物 API、圖片、年代規則與品質報告 |
| `NpmShopSampleCollector` | 觀察商城分類與來源網站結構；不作為目前正式商品圖片來源 |
| `ArtifactProductGenerator` | 由授權文物產生對應的縮小複製品商品、尺寸、文案與示意價格 |
| `NpmDataImporter` | 8 類文物資料包預檢與安全匯入 |
| `NpmDataWorkbench` | Windows GUI，執行估算、整理與匯入前檢查 |
| `QmahDatabaseRelease` | 匯出完整 SQL、還原 backup、schema／data parity、EF 模型驗證與本機展示資料產生 |
| `Export-ReferenceDatabase.ps1` | 資料庫整合者使用的單一 Release pipeline 入口 |

各工具的資料來源與操作細節，請查看同層的工具 README

## 完整資料庫 Release 流程

只有資料庫整合者需要執行這支 PowerShell：

```powershell
.\tools\QmahDataTools\Export-ReferenceDatabase.ps1 -Version 0.7.0
```

它會從同一個 canonical/reference SQL Server database 產生並驗證：

```text
database/QMAH.sql
QMAH-0.7.0.sql
QMAH-0.7.0.bak
SHA256SUMS.txt
```

流程不使用 EF Migration，也不由網站啟動時建表。每次執行都會在隔離的暫時 LocalDB instance：

- 還原同一份 source backup
- 移除 SSMS Diagram 系統物件
- 匯出固定順序的 Schema、資料、index、unique constraint、foreign key、programmable object 與 trigger
- 以另一份完整 SQL 建立新的資料庫
- 比較兩邊的 schema metadata、每表 row count 與穩定 SHA-256 data hash
- 驗證 `QmahDbContext` 與 `QMAH.Web` 能連線啟動

匯出成功才會更新 `database/QMAH.sql`。`.bak`、Release SQL、checksum 與驗證報告只會放在工作區根目錄 `_工具輸出`

完整的還原與版本管理規則請看 [`database/README.md`](../../database/README.md)

## Canonical 資料邊界

匯出工具不根據目前程式碼是否已經有 Controller 使用某張表來刪除資料，也不替尚未合併的 Area 猜測 business schema

目前匯出的資料就是 canonical reference database 在該 commit 的完整非 Diagram snapshot

工具會掃描 `aaa`、`test123`、`temp` 等明顯佔位值並產生報告，但不會自行刪除無法判定的資料；正式資料、展示資料與個人測試資料的邊界仍由資料庫整合者依文件、seed、reference DB 與各 Area 確認

未來 Area 合併新的 table、欄位或共同資料後，只需更新 canonical database，再執行同一支 pipeline，不需要另建第二套 exporter

## 建置

需要 .NET 10 SDK

```powershell
dotnet restore --locked-mode
dotnet build QMAH.sln --configuration Release
```

`QmahDatabaseRelease` 已加入 `QMAH.sln`，會跟網站一起由本機與 GitHub Actions 建置

### 展示帳密

Repository 根目錄的 `QMAH.DemoCredentials.csv` 是可提交的空白密碼範本。需要重建展示會員時，先複製成根目錄的 `QMAH.DemoCredentials.local.csv`，再填妥全部 24 筆 Password；工具會自動在同一位置建立 `QMAH.DemoCredentials.local.backup.csv`。缺少檔案、帳號或密碼時會直接停止，不會自動產生密碼。這兩個 `.local` 檔案已排除在 Git 外；也可以用 `--credentials` 與 `--backup` 明確指定其他本機路徑。

它的 `generate-showcase-data` 命令會讀取目前資料庫中的展示會員、文物與縮小複製品商品，產生與實際資料互相連結的社群貼文、留言、訂單、訂單明細、付款紀錄與商品評價。社群文章使用大量固定順序的獨立素材，並以穩定識別碼更新；不靠亂數拼接句子，也不循環重用預設展示範圍內的文章，因此重跑時不會把文章、文物或活動配錯。商品評價會連到真實商品與會員，並由 API 提供公開摘要及目前會員自己的維護操作。命令不會刪除其他資料；資料庫整合者完成這些資料後，必須用 `Export-ReferenceDatabase.ps1` 產生一份可直接還原的完整 `.bak`／`.sql`。一般組員不需要在還原後執行本命令；完整流程與實際快照數量請看 [`docs/15-local-showcase-and-credentials.md`](../../docs/15-local-showcase-and-credentials.md) 與 [`docs/02-development-data.md`](../../docs/02-development-data.md)。

工具輸出、raw、快取、log、bin、obj、大型執行檔與資料庫檔案不進 Repository
