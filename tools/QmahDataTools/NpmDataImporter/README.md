# NpmDataImporter

本工具驗證並匯入已標準化的文物資料包。一般網站開發不需要執行本工具；建立本機資料庫時，可從 GitHub Release 還原參考 `.bak`，或直接執行 Repository 的 `database/QMAH.sql`，兩種方式擇一即可。

安全地把已核對的文物資料包新增到 QMAH。舊商城資料包參數仍保留相容性，但目前正式商品改由獨立的 `ArtifactProductGenerator` 從已匯入文物建立。工具只接受已存在的 SQL Server Schema，不建立資料庫、不執行 EF Migration，也不覆蓋既有資產。

## 預檢順序

```powershell
NpmDataImporter.exe --project C:\path\to\QMAH --artifacts C:\path\to\artifacts.import.json --products C:\path\to\products.import.json --media-root C:\path\to\media
```

預檢會確認：

- 8 個正式文物分類各至少 32 筆，且年代為 `AUTO_VERIFIED`、可對應單一年代桶。
- `QuestionEnabled=true` 的文物會同步建立缺少的 `game.ArtifactQuestionEntries`；已存在的題庫設定不覆蓋。
- 若使用舊商城資料包流程，至少 48 筆且來源／價格／圖片欄位完整；目前正式基準不使用這條流程。
- 目標 SQL Server 可連線且已有 QMAH Schema。
- `ArtifactRef`、`ExternalRef` 與目標圖片路徑沒有衝突。

預檢成功才會輸出一次性 `APPROVAL_TOKEN`；若資料庫不存在或缺少必要表，工具會停止並回報，不會建立資料庫或補表。確認資料包沒有變動後，才可帶同一確認碼執行：

```powershell
NpmDataImporter.exe --project C:\path\to\QMAH --artifacts C:\path\to\artifacts.import.json --products C:\path\to\products.import.json --media-root C:\path\to\media --apply --approve <APPROVAL_TOKEN>
```

匯入策略固定為只新增、重複略過；不覆蓋網站圖片、既有文物或商城營運中的 `Stock`。資料庫 Schema 的設計來源是 SQL Server／ERD／`database/Schema.sql`，Entity 只做映射；`*.upsert.sql` 僅供核對，不取代預檢流程。

正式商品由 `ArtifactProductGenerator` 維護時，可用 `--skip-products` 只匯入文物並同步題庫設定；此模式不讀取舊商城資料包，也不改動現有商品。
