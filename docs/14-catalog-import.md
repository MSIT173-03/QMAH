# 文物資料匯入

QMAH 的文物匯入採「產生／預檢 → 確認 → 套用」流程。管理員可以在 `QMAH.Web` 的 Catalog → 文物資料匯入直接上傳資料包；批次或 CI 則使用 `NpmDataImporter`。兩者共用 `QMAH.Infrastructure/Infrastructure/CatalogImport` 的解析、驗證、同步與冪等規則。

匯入器只接受已存在的 QMAH SQL Server Schema，不建資料庫、不建表、不使用 EF Migration，也不在網站啟動時自動匯入。

## 資料邊界

一批文物可以同時影響三個功能，但責任仍分開：

```text
catalog.Artifacts
  ├─ game.ArtifactQuestionEntries   題庫設定
  └─ store.Products                  商城商品
```

- 文物是圖鑑、遊戲與題庫共用的主資料。
- 題庫同步預設開啟；只有明確取消才不更新題庫入口。
- 商城同步是獨立選項，預設關閉；開啟後才檢查或產生商品。
- 匯入不覆蓋商品人工價格、庫存與上架狀態，也不複製文物官方圖片。
- 同一批資料重複匯入會辨識相同文物／商品，不重複建立資料列或圖片。

目前正式基準為 8 個分類、每類 32 件，共 256 件文物、256 筆題庫與 256 件對應展示商品。這是參考資料量，不是資料表硬限制；實際匯入量以資料包與預檢結果為準。

## 後台操作

1. 管理員登入 `QMAH.Web`，開啟 Catalog → 文物資料匯入。
2. 上傳文物 JSON；需要同步商城時再上傳商品 JSON。圖片可用 ZIP，一起放入資料包指定的相對路徑。
3. 確認「題庫同步」維持勾選。只有已確認不希望更新題庫時才取消。
4. 依需求選擇「商城同步」。不勾選時，匯入只處理文物與題庫。
5. 按「預覽匯入」，先確認候選、新增、更新、未變更、無效、無法對應、圖片與同步數量。
6. 預覽無誤後按「確認匯入」。系統使用同一次暫存資料包與確認碼，不接受修改資料後跳過預檢。

上傳限制為文物／商品 JSON 各 32 MB、圖片 ZIP 256 MB；解壓縮後與單一檔案也有大小及檔案數限制。匯入暫存放在系統暫存目錄，完成或失敗後會清理；圖片與資料庫交易不完整時，不會把半套圖片當成成功結果。

## JSON 最小欄位

文物資料至少應能辨識：

```json
{
  "artifactRef": "故宮資料的作品編號（匯入比對鍵）",
  "name": "文物名稱",
  "categoryCode": "分類代碼",
  "eraBucketCode": "年代桶代碼",
  "sourceUrl": "來源頁網址",
  "imageUrl": "/media/catalog/.../display.jpg",
  "thumbnailUrl": "/media/catalog/.../thumbnail.jpg"
}
```

可選欄位包括來源分類名稱、原始年代文字、描述、尺寸、作者、授權、姓名標示、原始 JSON、是否納入題庫與穩定 `id`。工具也接受既有資料處理流程常見的別名與最多三層的 `artifacts`／`items`／`records`／`data`／`results` 包裝，但欄位語意不能因此猜測。

商品資料在選擇商城同步時至少應能辨識商品編號、名稱、分類、價格、庫存與圖片；若有 `artifactRef`，會再核對商品與文物的對應。缺少價格或庫存不會預設成 0，而會列為無效，避免把缺資料誤當成免費或零庫存。

## 命令列工具

在 Repository 根目錄執行預檢：

```powershell
dotnet run --project .\tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project . `
  --artifacts C:\path\to\artifacts.import.json `
  --products C:\path\to\products.import.json `
  --media-root .\QMAH.Web\wwwroot\media
```

CLI 的預設行為是同步題庫與商城；因此未使用 `--skip-products` 時，必須同時提供 `--products`，文物每分類上限 32、商品上限 256。只驗證文物與題庫時，明確使用 `--skip-products`：

```powershell
dotnet run --project .\tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project . `
  --artifacts C:\path\to\artifacts.import.json `
  --media-root .\QMAH.Web\wwwroot\media `
  --skip-products
```

若題庫確實不應同步，才明確加上 `--no-question-bank`。要套用時，先複製同一次預檢輸出的確認碼：

```powershell
dotnet run --project .\tools\QmahDataTools\NpmDataImporter\NpmDataImporter.csproj -- `
  --project . `
  --artifacts C:\path\to\artifacts.import.json `
  --products C:\path\to\products.import.json `
  --media-root .\QMAH.Web\wwwroot\media `
  --apply `
  --approve <本次預檢確認碼>
```

CLI 也接受相容別名，例如 `--qmah-root`、`--artifact-file`、`--product-file`、`--media`、`--connection-string` 與 `--approval-token`。正式文件以長名稱為主，別名只為銜接既有腳本；不要在不同腳本各自發明新參數。

後台與 CLI 的商城預設值不同，是因為使用情境不同：後台畫面預設關閉商城同步，讓管理員先確認是否要建立或更新商品；CLI 在提供商品檔且未使用 `--skip-products` 時才會執行商城同步。兩者的文物、題庫、商品驗證與冪等規則仍由同一個 Infrastructure 匯入核心處理。題庫同步在兩種入口都預設開啟，只有後台取消勾選或 CLI 明確加入 `--no-question-bank` 才會關閉。

## 失敗與重試

- 預檢失敗：先修正資料包或圖片資產，再重新預檢；原確認碼不可沿用。
- 確認碼過期或資料包被改動：重新執行預檢。
- 年代無法對應：保留為無法對應，不用另一個年代硬湊。
- 來源／授權／圖片不足：補齊來源資料，不要在 Controller 裡補假的值。
- DB 交易失敗：確認資料庫 Schema、連線與圖片根目錄；工具會回滾資料庫並清理本次新增檔案。

raw JSON、HTTP response、下載快取、圖片 ZIP 與匯入 log 放在 Repository 外或 `_工具輸出`，不提交到 Git。後台匯入完成後，資料庫才是共同結果；不要把個人機器的暫存檔當成正式資料包。
