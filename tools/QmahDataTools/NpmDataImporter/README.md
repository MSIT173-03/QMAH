# NpmDataImporter

`NpmDataImporter` 是已標準化文物資料包的命令列預檢與匯入工具。一般網站開發不需要執行；管理員日常匯入使用後台的「文物匯入」，命令列工具用於批次資料、CI 前檢查與問題重現。

匯入核心位於 `QMAH.Infrastructure/Infrastructure/CatalogImport/`，因此後台、命令列工具與其他主機使用同一套驗證、同步與冪等規則。工具只接受已存在的 QMAH SQL Server Schema，不建立資料庫、不建立資料表、不執行 EF Migration，也不覆蓋既有圖片。

## 正式資料量與小量驗證

目前參考資料包是 8 個分類、每類 32 件，共 256 件文物；題庫同步與商城商品也各有 256 筆。CLI 預設以完整基準量檢查：每類最多 32 件、商品最多 256 件。上限是篩選上限，不是資料庫硬限制；需要處理不同批次時可以明確指定參數。

`--skip-products` 是刻意保留的小量文物／題庫驗證模式，不代表正式匯入只能處理少量資料。後台 UI 不設每類 32 件的 CLI 篩選，會依上傳資料包預檢後處理所有合格項目。

## 使用方式

先準備一份由 `NpmArtifactPipeline` 或既有資料處理流程產出的文物 JSON。圖片來源欄位以 `/media/...` 網站路徑表示時，`--media-root` 要指向實體的 `wwwroot\media` 資料夾：

```powershell
dotnet run --project tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project C:\path\to\QMAH `
  --artifacts C:\path\to\artifacts.import.json `
  --products C:\path\to\products.import.json `
  --media-root C:\path\to\QMAH\QMAH.Web\wwwroot\media
```

完整 256 件資料包可省略數量參數，使用預設值。只檢查文物與題庫、不讀取商品資料時：

```powershell
dotnet run --project tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project C:\path\to\QMAH `
  --artifacts C:\path\to\artifacts.import.json `
  --media-root C:\path\to\QMAH\QMAH.Web\wwwroot\media `
  --skip-products
```

小量流程驗證可明確降低上限；這是測試選項，不會改變正式資料包的數量：

```powershell
dotnet run --project tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project C:\path\to\QMAH `
  --artifacts C:\path\to\artifacts.import.json `
  --media-root C:\path\to\QMAH\QMAH.Web\wwwroot\media `
  --skip-products `
  --artifact-per-category 1
```

## 預檢與正式套用

第一次執行不會寫入資料庫，只會顯示候選、可新增、可更新、未變更、無效、無法對應與題庫同步數量。資料確認無誤後，複製同一次顯示的 `APPROVAL_TOKEN`，用完全相同的參數加上 `--apply --approve`：

```powershell
dotnet run --project tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project C:\path\to\QMAH `
  --artifacts C:\path\to\artifacts.import.json `
  --products C:\path\to\products.import.json `
  --media-root C:\path\to\QMAH\QMAH.Web\wwwroot\media `
  --apply `
  --approve <預檢輸出的確認碼>
```

匯入規則如下：

- 文物是圖鑑、遊戲與題庫共用的主資料；題庫同步預設開啟，只有明確在後台取消或改用程式設定時才會關閉。
- 勾選商城同步時，商品資料必須通過分類、價格、庫存、圖片與文物關聯檢查；後台沒有提供商品檔時，會依合格文物建立可停用的展示商品。
- 相同故宮編號或商品編號會被辨識為既有資料。來源文字、分類、年代、授權與價格等來源欄位可更新；圖片、庫存與人工上架狀態不由匯入覆蓋。
- 第二次使用相同資料包會顯示 `unchanged`，不會重複建立文物、題庫、商品或複製圖片。
- 來源網址、授權代碼、姓名標示與原始資料快照必須隨資料包保留；年代無法可靠對應時列為無法對應，不自行猜測。
- 圖片先複製並驗證路徑，資料庫交易成功後才算完成；資料庫失敗時會清理本次已複製的新增資產。

若資料庫不存在、Schema 不完整、圖片缺少、路徑不安全或資料包內容在預檢後被修改，工具會停止，不會建立資料庫或補表。

## 後台操作

管理員登入 `QMAH.Web` 後，從 Catalog 的「文物匯入」進入：

1. 上傳文物 JSON，必要時上傳商品 JSON 與圖片 ZIP。
2. 先按「預覽匯入」，確認數量、警告、題庫同步與商城同步狀態。
3. 題庫同步預設勾選；商城同步預設不勾選，只有確定要建立或更新商品時才開啟。
4. 確認預覽結果後按「確認匯入」。預檢與正式套用使用同一個暫存資料包，不接受手動修改後繞過預檢。

外部資料讀取使用 `IHttpClientFactory`、`System.Text.Json` 與 `CancellationToken`。來源失敗時後台只顯示可理解的處理訊息，不把內部欄位名稱、路徑或例外細節直接放到畫面。

## 相關工具

- `NpmArtifactPipeline`：抓取、整理、年代標準化、圖片下載與產出文物匯入包。
- `ArtifactProductGenerator`：依既有文物產生 256 件展示商品資料；不覆蓋已存在的商品營運欄位。
- `NpmShopSampleCollector`：舊商城來源的相容性收集工具，不作為目前文物主檔與商品同步的必要步驟。

各工具輸出建議放在工作區外或 `_工具輸出`，不要把 raw JSON、下載快取、帳密 CSV 或測試資產提交到 Repository。
