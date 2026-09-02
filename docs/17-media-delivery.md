# 媒體交付設定

本文件定義 QMAH 的圖片路徑、檔案同步與公開交付方式。資料庫保存的是穩定的邏輯路徑，應用程式再依執行環境將邏輯路徑解析成本機網址或 CDN（內容傳遞網路）網址。這樣更換檔案來源時不需要批次改寫資料庫欄位。

目前版本的共用設定固定使用 `Local`，供本機開發與測試。Azure 或 Cloudflare 的設定只作為未來測試環境、預備環境與正式環境的部署設定，不應直接寫入本機預設設定檔。

## 1. 路徑與責任範圍

### 1.1 資料庫保存邏輯路徑

文物、商品、會員頭像與成就圖示的資料欄位保存邏輯路徑，例如：

```text
/media/catalog/bronze/故銅000873N000000000/display.jpg
/media/catalog/bronze/故銅000873N000000000/thumbnail.jpg
/media/store/product-001/main.webp
/uploads/avatars/member-001.jpg
/uploads/achievements/first-login.svg
```

邏輯路徑的根目錄只有 `/media` 與 `/uploads`。目錄名稱、檔名與資料庫內容應保持穩定；部署環境的網域與路徑前綴不寫入資料庫。

### 1.2 各元件的責任

| 元件 | 責任 |
| --- | --- |
| `CatalogImportService` | 產生 `/media/...` 邏輯路徑，並將匯入檔案寫入目前設定的本機媒體根目錄 |
| `Media:RootPath` | 指定匯入與上傳時使用的實體檔案根目錄；這是檔案系統路徑，不是公開網址 |
| `QmahMediaUrlResolver` | 將 `/media/...`、`/uploads/...` 轉成本機相對網址或 CDN 公開網址 |
| API DTO | 回傳解析後的圖片網址，讓前台不需要自行拼接磁碟路徑 |
| Razor `MediaUrlTagHelper` | 將 Web 頁面中的公開 `<img src>` 與 `<source src>` 套用相同的網址解析規則 |
| CDN／Blob／R2 | 提供檔案的公開讀取與快取；不負責修改資料庫邏輯路徑 |

目前的 `Cdn` 模式只改變對外網址，不會自動把本機檔案上傳至 Azure Blob Storage 或 Cloudflare R2，也不會在 CDN 暫時無法連線時逐張圖片發出健康檢查。檔案同步與 CDN 路由必須先由部署流程完成。

### 1.3 目前 Local 模式

版本庫中的下列設定目前明確使用 `Local`：

- `QMAH.Api/appsettings.json`
- `QMAH.Api/appsettings.Development.json`
- `QMAH.Api/appsettings.Local.example.json`
- `QMAH.Web/appsettings.json`
- `QMAH.Web/appsettings.Development.json`
- `QMAH.Web/appsettings.Local.example.json`

本機設定的核心內容如下。API 與 Web 的 `RootPath` 依各自的內容根目錄不同，不能直接互換。

```json
{
  "Media": {
    "RootPath": "wwwroot/media",
    "DeliveryMode": "Local",
    "PublicBaseUrl": "",
    "PublicPathPrefix": ""
  }
}
```

API 專案的共用設定使用 `../QMAH.Web/wwwroot/media`，讓 API 的受控上傳與本機 Web 媒體目錄保持一致；Web 專案使用 `wwwroot/media`。Development 設定明確寫出 `Local`，方便檢查啟動環境的實際預設值。

## 2. 設定欄位

| 設定欄位 | Local | Cdn |
| --- | --- | --- |
| `Media:RootPath` | 本機媒體實體根目錄 | 匯入、上傳或保留本機備援檔案時仍可使用；切換 CDN 不會自動改變檔案寫入位置 |
| `Media:DeliveryMode` | `Local` | `Cdn` |
| `Media:PublicBaseUrl` | 留白 | 公開資產網域，例如 `https://assets.example.com`；只能使用 `http` 或 `https`，不可含 query string（查詢字串）或 fragment（片段識別碼） |
| `Media:PublicPathPrefix` | 留白 | 公開 CDN 網址的額外前綴，例如 `/qmah`；沒有前綴時應留白 |

部署至 Azure App Service 或其他託管平台時，設定鍵可使用環境變數形式：

```text
Media__DeliveryMode=Cdn
Media__PublicBaseUrl=https://assets.example.com
Media__PublicPathPrefix=
```

環境變數中的雙底線 `__` 代表 JSON 設定的階層分隔。`PublicBaseUrl` 是應用程式回傳給瀏覽器的網址，不是 Blob Storage 的管理端點，也不是 Cloudflare API Token。Token、SAS（共用存取簽章）與帳號密鑰不應放進版本庫或回傳給前端。

## 3. 網址解析規則

### 3.1 轉換範例

以資料庫中的下列值為例：

```text
/media/catalog/bronze/故銅000873N000000000/display.jpg
```

解析結果如下：

| 設定 | API／頁面回傳網址 |
| --- | --- |
| `DeliveryMode=Local` | `/media/catalog/bronze/故銅000873N000000000/display.jpg` |
| `DeliveryMode=Cdn`、`PublicBaseUrl=https://assets.example.com`、前綴留白 | `https://assets.example.com/media/catalog/bronze/故銅000873N000000000/display.jpg` |
| `DeliveryMode=Cdn`、`PublicBaseUrl=https://assets.example.com`、`PublicPathPrefix=/qmah` | `https://assets.example.com/qmah/media/catalog/bronze/故銅000873N000000000/display.jpg` |

### 3.2 保留與回復規則

- 已經是 `http://`、`https://` 或協定相對網址（例如 `//static.example.com/a.jpg`）時，不會重複加上 CDN 網域。
- Windows 反斜線會正規化為 `/`，避免資料庫歷史資料產生不一致網址。
- 不是 `/media` 或 `/uploads` 根目錄的值不會被當成公開媒體資產處理。
- `DeliveryMode` 不是 `Cdn`、`PublicBaseUrl` 遺漏、網址格式錯誤、含 query string 或含 fragment 時，解析器會回傳正規化後的 Local 路徑。
- 這個設定回復只處理「設定不合法」的情況。設定合法但 CDN 在網路上中斷時，已回傳的 `https://assets.example.com/...` 不會由解析器自動改回 `/media/...`。可用的可用性方案是 CDN 的來源健康檢查、來源故障轉移或部署層級切換；不應讓每個圖片元件自行猜測第二個網址。

### 3.3 公開媒體與受保護媒體

文物與商城公開資產可使用 `/media/...`；已設定為公開交付的會員頭像或成就圖示可使用 `/uploads/...`。Cloudflare 或 Azure 的快取規則應只涵蓋確認可公開的路徑。

社群圖片目前不是公開靜態路徑。`/api/v1/social/media/{id}/content` 會先檢查資產狀態、貼文發布狀態與擁有者，再由 API 以受控檔案串流回傳。這類內容不可直接複製到無驗證的公開 CDN 路徑。若日後需要加速，需另外設計短效簽名網址、受控邊緣轉送與刪除失效機制。

## 4. 未來導入 CDN 的共同準備

無論採用 Azure 或 Cloudflare，都要先完成以下共同條件：

1. 保留資料庫中的 `/media/...` 與 `/uploads/...` 邏輯路徑，不做網域批次取代。
2. 將本機媒體目錄同步至物件儲存或 CDN 所使用的來源，並保留 `media/...`、`uploads/...` 後的相對目錄與檔名。
3. 讓 CDN 公開 URL 的路徑與應用程式回傳值一一對應。若使用 `PublicPathPrefix=/qmah`，CDN 必須能將 `/qmah/media/...` 對應至來源的 `media/...`；也可以把 `qmah/` 一起作為物件鍵前綴，但兩端只能選一種規則。
4. 確認所有圖片的 `Content-Type`（HTTP 媒體類型）正確，例如 JPEG 為 `image/jpeg`、PNG 為 `image/png`、SVG 為 `image/svg+xml`。
5. 先在測試或預備環境切換 `Cdn`，確認 API JSON、Razor 頁面、圖片預覽、空圖片狀態與含中文檔名的網址。
6. 生產環境切換後保留本機或來源端備份，直到完成回滾窗口與快取驗證。

切換 `Cdn` 不代表已完成檔案遷移。現有匯入流程仍會寫入 `Media:RootPath`，因此正式部署必須擇一：

- 在匯入／上傳後由部署工作同步本機媒體到物件儲存；或
- 另行實作直接寫入 Blob／R2 的儲存服務，並更新上傳、刪除、軟刪除清理與錯誤補償流程。

第二種方案涉及實體儲存責任變更，不屬於目前 `QmahMediaUrlResolver` 的設定切換。

## 5. Azure Blob Storage + Azure Front Door

Azure 的建議架構是把 Blob Storage 作為來源，以 Azure Front Door 作為公開入口。Microsoft 的 [Blob Storage 搭配 Azure Front Door 說明](https://learn.microsoft.com/en-us/azure/frontdoor/scenario-storage-blobs)涵蓋 Blob 來源、網域與存取控制的配置方式。

### 5.1 物件鍵設計

建議使用一個媒體容器，讓物件鍵直接對應邏輯路徑去除開頭的 `/`：

```text
資料庫邏輯路徑：/media/catalog/bronze/item/display.jpg
Blob 物件鍵：  media/catalog/bronze/item/display.jpg

資料庫邏輯路徑：/uploads/avatars/member-001.jpg
Blob 物件鍵：  uploads/avatars/member-001.jpg
```

若使用兩個容器，或 Blob 物件鍵前面還有容器專用前綴，Front Door 必須透過不同路由或 URL rewrite（網址重寫）補上／移除該前綴。應先固定一份路徑對照表，再開始同步，避免出現「API 回傳 200 但圖片永遠 404」的錯誤。

### 5.2 同步本機資產

AzCopy 可遞迴同步目錄。下列指令只展示路徑結構，`<SAS>` 必須由部署環境安全注入，不應寫入腳本或版本庫：

```powershell
azcopy sync "C:\path\to\QMAH.Web\wwwroot\media" `
  "https://<storage-account>.blob.core.windows.net/<container>/media?<SAS>" `
  --recursive=true `
  --delete-destination=false

azcopy sync "C:\path\to\QMAH.Web\wwwroot\uploads" `
  "https://<storage-account>.blob.core.windows.net/<container>/uploads?<SAS>" `
  --recursive=true `
  --delete-destination=false
```

`--delete-destination=false` 是保守的初始設定，避免同步時刪除來源端尚未存在的物件。Microsoft 的 [AzCopy Blob 上傳說明](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-blobs-upload)與 [AzCopy sync 說明](https://learn.microsoft.com/en-us/azure/storage/common/storage-ref-azcopy-sync)提供驗證方式、遞迴同步與刪除選項的完整定義。正式流程應先在測試容器驗證物件鍵、檔案數量、檔案大小與 `Content-Type`，再決定是否啟用刪除同步。

若容器為私有，來源存取可使用受控身分、SAS 或 Front Door Premium 的 Private Link（私有連結）。公開圖片的 Front Door URL 不應暴露 Storage Account 金鑰；若將 SAS 放進公開圖片 URL，必須同時規劃快取鍵、有效期限與到期後重新產生網址。

### 5.3 Front Door 路由

建立 Front Door profile、origin group 與 Blob origin 後，至少建立下列公開路由：

| 公開路徑 | 來源對應 | 快取 |
| --- | --- | --- |
| `/media/*` | Blob `media/*` | 可快取公開圖片 |
| `/uploads/*` | Blob `uploads/*` | 只有確認公開的資產可快取 |
| `/api/*` | 應用程式 API | 不作公開靜態快取 |

設定 `PublicPathPrefix=/qmah` 時，公開路由會變成 `/qmah/media/*` 與 `/qmah/uploads/*`。此時 Front Door 的路由／規則必須將 `/qmah/` 移除後再取來源，或同步時把 `qmah/` 寫入 Blob 物件鍵。應用程式本身只會加上前綴，不會替 Front Door 做路徑重寫。

自訂網域、TLS（傳輸層安全性）與 WAF（Web 應用程式防火牆）應在 Front Door 層設定。若來源需要維持私有，使用支援 Private Link 的方案；若使用公開 Blob 來源，則需限制來源內容、容器權限與 SAS 生命週期。Azure Storage 的 [自訂網域說明](https://learn.microsoft.com/sr-cyrl-rs/azure/storage/blobs/storage-custom-domain-name)可作為網域規劃參考。

### 5.4 Azure 應用程式設定

Azure App Service 的 Application settings（應用程式設定）設定在 API 與 Web 兩個程序，值必須一致：

```text
Media__DeliveryMode=Cdn
Media__PublicBaseUrl=https://assets.example.com
Media__PublicPathPrefix=
```

`Media:RootPath` 是否保留本機路徑，取決於匯入／上傳是否仍由應用程式寫入本機。若沒有同步工作或直接 Blob 儲存服務，單純把 `DeliveryMode` 改成 `Cdn` 會導致新檔案只存在本機而 CDN 找不到。

### 5.5 Azure 快取與大型檔案

圖片、CSS 與 JavaScript 適合快取；登入狀態、API 回應與含權限判斷的內容不應被公開快取。Azure Front Door 的 [快取行為說明](https://learn.microsoft.com/en-gb/azure/frontdoor/front-door-caching)涵蓋 query string、`Cache-Control`、快取清除與快取鍵設定。

現有資料庫檔名多為穩定路徑。覆寫相同檔名時，邊緣節點可能仍保存舊內容，因此更新後要清除受影響 URL，或未來改用版本化檔名／路徑。使用大量圖片或原始大檔的 Range request（分段讀取請求）時，需一併檢查來源壓縮與 `Accept-Encoding` 行為，避免 Front Door 與來源對分段回應的處理不一致。

## 6. Cloudflare CDN

Cloudflare 有兩種適合目前資料模型的做法：

- Cloudflare Proxy：檔案仍放在 QMAH Web 的公開來源，Cloudflare 代理並快取 `/media`、`/uploads`。
- Cloudflare R2：檔案放到 R2 物件儲存，以自訂網域提供檔案，再由 Cloudflare 快取。

兩種做法都使用相同的應用程式設定；差異在 CDN 網域背後的來源位置。

### 6.1 Cloudflare Proxy：沿用 QMAH Web 來源

此方案不需要 R2，適合先驗證 CDN 路由與快取：

1. 建立 `assets.example.com` DNS 記錄，指向可公開存取的 QMAH Web 來源，並開啟 Cloudflare proxy。
2. 設定 SSL/TLS 為符合來源憑證的模式，建議使用完整且驗證來源憑證的設定。
3. 建立 Cache Rule（快取規則），只匹配 `assets.example.com` 且 URI path（URI 路徑）以 `/media/` 或 `/uploads/` 開頭的請求。
4. 對 `/api/`、登入 Cookie、帶權限的回應與社群媒體 endpoint 設定 bypass（略過快取）。不可對整個網域直接套用 Cache Everything（全部快取）。
5. 設定 API 與 Web 的 `Media` 值：

   ```text
   Media__DeliveryMode=Cdn
   Media__PublicBaseUrl=https://assets.example.com
   Media__PublicPathPrefix=
   ```

6. 用瀏覽器或 HTTP 工具檢查 `Content-Type`、`ETag`、`Last-Modified`、`Cache-Control` 與 `CF-Cache-Status`，並確認第二次請求可命中預期的快取規則。

若使用 `/qmah` 前綴，Cloudflare Cache Rule 要匹配 `/qmah/media/*` 與 `/qmah/uploads/*`，同時以 Transform Rule 或 Worker 將 `/qmah/` 移除後再送往 QMAH Web；也可以讓來源保留 `qmah/` 目錄。這個路徑選擇必須與 `PublicPathPrefix` 和檔案實際位置完全一致。

### 6.2 Cloudflare R2：物件儲存來源

R2 的容器稱為 bucket（儲存桶），物件鍵仍建議與邏輯路徑一一對應：

```text
media/catalog/bronze/item/display.jpg
uploads/avatars/member-001.jpg
```

部署步驟如下：

1. 建立 R2 bucket，將本機 `wwwroot/media` 與 `wwwroot/uploads` 同步到 `media/` 與 `uploads/` 物件鍵前綴。
2. 在 R2 綁定自訂網域，例如 `assets.example.com`。Cloudflare 的 [R2 公開 bucket 與自訂網域說明](https://developers.cloudflare.com/r2/buckets/public-buckets/)指出，`r2.dev` 適合開發用途，不應作為正式流量入口；自訂網域才能使用 Cloudflare 快取、WAF 與相關存取控制。
3. 若資產可公開，使用自訂網域對應公開物件；若資產需要權限，保留 bucket 私有，改用 Worker、短效簽名 URL 或 Access 控制，不可只靠 `Media:DeliveryMode=Cdn` 使私有物件安全。
4. 建立只涵蓋公開媒體路徑的 Cache Rule。Cloudflare [R2 快取說明](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)指出，預設快取範圍不是所有檔案類型都相同；需要時應明確設定靜態圖片路徑的快取規則。
5. 若來源讀取量較大，可評估 Smart Tiered Cache（分層快取），減少多個邊緣節點同時讀取 R2。覆寫或刪除物件後，依 TTL（存活時間）與快取規則清除對應 URL。
6. 將 API 與 Web 設定為：

   ```text
   Media__DeliveryMode=Cdn
   Media__PublicBaseUrl=https://assets.example.com
   Media__PublicPathPrefix=
   ```

R2 本身的物件鍵不應包含資料庫 URL 的開頭斜線。若使用 `/qmah` 公開前綴，必須在 Cloudflare 端重寫路徑，或把 `qmah/` 寫入 R2 物件鍵；不應同時採用兩種方案。

### 6.3 Cloudflare 快取失效與驗證

資產更新、覆寫或刪除時，舊內容可能仍存在邊緣快取。可採用以下其中一種策略：

- 使用 Cloudflare Cache Rules 設定合理 TTL，更新後以 URL purge（依網址清除快取）。
- 以版本化檔名或 query string 產生新 URL；這需要匯入流程或資料庫路徑策略配合，不是目前設定切換的一部分。

Cloudflare [Cache Rules 自訂快取說明](https://developers.cloudflare.com/cache/concepts/customize-cache/)與 [Purge Cache API](https://developers.cloudflare.com/api/resources/cache/methods/purge/)可作為規則與自動化部署的依據。清除快取時應限制在受影響的媒體 URL，不應在每次部署時清除整個網域。

## 7. 設定切換與回滾

### 7.1 切換至 CDN

1. 確認資料庫仍保存 `/media/...`、`/uploads/...`，且來源端已完成檔案同步。
2. 確認 CDN 公開 URL 可以直接讀取一張縮圖、一張原圖、一個商品圖片與一個成就圖示。
3. 確認 CDN 的路徑前綴、來源重寫、MIME type、TLS 與快取規則。
4. 只在測試／預備環境將 API 與 Web 的 `DeliveryMode` 改為 `Cdn`。
5. 執行圖鑑、商城、會員資料、圖片預覽與匯入後檔案讀取的 smoke test（冒煙測試）。
6. 確認新匯入或新上傳檔案會同步至 CDN 來源，再切換正式環境設定。

### 7.2 回到 Local

回滾不需要修改資料庫：

```text
Media__DeliveryMode=Local
Media__PublicBaseUrl=
Media__PublicPathPrefix=
```

確認 `Media:RootPath` 的本機檔案仍存在後重啟 API 與 Web。若 CDN 已快取錯誤內容，切換回 Local 後仍應依部署平台清除受影響的 CDN URL；Local 回應不會主動清除外部快取。

## 8. 驗證清單

### Local 模式

- API 與 Web 的 Development 設定都顯示 `DeliveryMode=Local`。
- API 回傳的公開圖片網址以 `/media/` 或 `/uploads/` 開頭，不是 CDN 絕對網址。
- Razor 頁面的圖片與 `<picture>`／`<source>` 圖片可正常讀取。
- 匯入、商品圖片、會員頭像與成就圖示都能在本機取得。
- 社群圖片仍透過 `/api/v1/social/media/{id}/content` 的權限檢查取得。

### CDN 預備環境

- API 與 Web 的 `DeliveryMode`、`PublicBaseUrl`、`PublicPathPrefix` 完全一致。
- 每個資料庫邏輯路徑都能對應到唯一的 CDN URL 與來源物件。
- 中文檔名、URL 編碼、大小寫與目錄層級在來源與 CDN 端一致。
- `Content-Type`、`Cache-Control`、`ETag`、`Last-Modified` 與 Range response（分段回應）符合預期。
- `/api/*`、登入狀態、社群受保護媒體沒有被公開快取。
- 覆寫、刪除與重新匯入後，已執行精確 URL purge 或採用新版本 URL。
- 來源端暫時失效時，有經過 CDN health check／failover（健康檢查／故障轉移）或部署層級回滾驗證；不把應用程式的設定格式回復誤認為網路故障自動回復。

## 9. 程式碼位置

- `QMAH.Infrastructure/Media/MediaDeliveryOptions.cs`：媒體交付設定模型。
- `QMAH.Infrastructure/Media/QmahMediaUrlResolver.cs`：Local／Cdn 網址解析、路徑正規化與不合法設定回復。
- `QMAH.Api/Program.cs`：API 的媒體根目錄與網址解析器註冊。
- `QMAH.Web/Program.cs`：Web 的網址解析器註冊與靜態資產處理。
- `QMAH.Web/Infrastructure/Media/MediaUrlTagHelper.cs`：Razor 公開圖片標籤的網址轉換。
- `QMAH.Infrastructure/Infrastructure/CatalogImport/CatalogImportService.cs`：匯入檔案與 `/media/...` 邏輯路徑的產生。

導入 Azure Blob、Cloudflare R2 或直接上傳 CDN 來源時，應新增獨立的儲存服務與同步／清理流程，不應把物件儲存 SDK、SAS 或 Cloudflare 憑證塞入網址解析器，也不應改寫資料庫內的既有邏輯路徑。
