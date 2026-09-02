# 地點與地圖串接說明

QMAH 目前採用的是簡單的地圖連結串接。後台保留地點文字與選填座標，管理頁面依資料產生 OpenStreetMap（開放街圖）連結；目前沒有在網站內嵌完整地圖，也沒有另外保存地圖服務的圖磚、地點識別碼或地理編碼結果。

這樣的設計讓地圖只是查看與選取地址的方式，活動、貼文與會員地址的主要資料仍由 QMAH 自己保存。Angular 前端使用者前台可以沿用相同欄位，在自己的畫面放入地圖元件或地圖選點流程，API 契約不需要改成某一家地圖服務的格式。

## 目前使用的技術

| 範圍 | 目前做法 |
| --- | --- |
| 後台 | ASP.NET Core MVC、Razor View 與共用 Admin Layout |
| 地圖連結 | `QMAH.Web/wwwroot/admin/js/qmah-location-links.js` 的共用原生 JavaScript |
| 地圖服務 | OpenStreetMap 網站連結，不需要 API Key |
| 資料來源 | `social.Events`、`social.SocialPosts`、`user.UserAddresses`；商城若保存地址也沿用相同欄位規則 |
| 座標型別 | SQL Server `decimal(9,6)`，緯度與經度都可為 null |
| 前端使用者前台起點 | Angular 21.2.22 透過 `HttpClient` 讀取 `/api/v1/*` |

展示資料中的兩個實體場館地址已依官方公開資訊整理：國立故宮博物院為臺北市士林區至善路二段 221 號（[官方參觀資訊](https://www.npm.gov.tw/Articles.aspx?l=1&sno=02013678)），國立故宮博物院南部院區為嘉義縣太保市故宮大道 888 號（[南部院區參觀資訊](https://south.npm.gov.tw/Visit)）。資料使用場館公開地址作為位置展示，並不表示 QMAH 與場館存在主辦、合作或授權關係。

後台畫面使用 `data-qmah-map-link` 標記地圖入口。共用檔案
`QMAH.Web/wwwroot/admin/js/qmah-location-links.js` 會依下列順序建立連結；
`qmah-admin.js` 保留表格排序、響應式列表與操作互動，不再持有地圖專用邏輯：

1. 有成對座標時，開啟 OpenStreetMap 的座標位置與縮放層級
2. 沒有座標但有地點文字時，開啟 OpenStreetMap 的文字搜尋
3. 兩者都沒有時，隱藏地圖入口

管理頁面的地址欄位目前仍可直接輸入文字與座標；輸入內容改變時，JavaScript 會重新整理連結。這是為了讓後台維持輕量的地址查看功能，不把地圖載入成本放進每一個管理頁面。

## API 回傳的地點資料

前台使用下列 API（應用程式介面）即可取得目前資料：

| API | 地點欄位 |
| --- | --- |
| `GET /api/v1/social/events` | `location`、`latitude`、`longitude` |
| `GET /api/v1/social/events/{id}` | `location`、`latitude`、`longitude` |
| `GET /api/v1/social/posts` | `locationName`、`latitude`、`longitude` |
| `GET /api/v1/social/posts/{id}` | `locationName`、`latitude`、`longitude` |
| `GET /api/v1/me/addresses` | `city`、`district`、`addressLine`、`latitude`、`longitude` |

`location` 或 `locationName` 是給人閱讀的地點名稱或地址。`latitude`（緯度）與 `longitude`（經度）是給地圖定位使用的選填欄位，兩者必須同時提供或同時省略。API 已限制緯度介於 `-90` 到 `90`、經度介於 `-180` 到 `180`。

線上活動的地點文字統一使用 `線上活動`，`latitude` 與 `longitude` 保持 `null`。實體活動若沒有可靠座標，保留地址文字並將兩個座標都留白；前台仍能顯示地址，不需要猜測位置。

活動建立或修改後，對應的活動貼文會沿用同一組地點文字與座標。前台讀活動資料或活動貼文時，應以回應中的欄位為準，不要從標題或內容拆地址。

地圖連結不是社群專屬功能。活動、貼文、會員收件地址與未來商城的取貨或配送地址，都可以在各自的管理頁引用同一個共用檔案。各業務頁只需要提供 `data-qmah-map-location`、`data-qmah-map-latitude`、`data-qmah-map-longitude` 或對應輸入欄位選擇器，不需要複製座標驗證與網址組合程式。

## Angular 前端使用者前台沿用管理後台的簡單連結

前台使用 Angular 時，可以把地圖連結組合集中在一個純函式或共用 service（服務）中。以下範例只處理網址，不代表要建立特定頁面：

```ts
export type MapLocation = {
  location?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function buildOpenStreetMapUrl(value: MapLocation): string | null {
  const text = value.locationName?.trim() || value.location?.trim() || '';
  const latitude = value.latitude;
  const longitude = value.longitude;
  const hasCoordinates =
    latitude !== null && latitude !== undefined &&
    longitude !== null && longitude !== undefined &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;

  if (hasCoordinates) {
    const lat = latitude.toFixed(6);
    const lon = longitude.toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }

  return text
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}`
    : null;
}
```

連結按鈕的畫面行為可以和後台一致：有座標就顯示「查看地圖」，只有文字就顯示「搜尋地址」，兩者都沒有就顯示地點未提供。連結使用新分頁時，應加上 `target="_blank"` 與 `rel="noopener noreferrer"`。

## 使用者前台加入地圖選點

若使用者前台需要讓使用者選擇活動集合位置或會員地址，可以在表單中加入地圖元件。選點完成後只要把結果寫回同一個 `latitude` 與 `longitude` 欄位，地址文字仍保留在 `location`、`locationName` 或 `addressLine`，再依 API 契約送出即可。

地圖元件可以由使用者前台自行選擇，例如 Leaflet（前端地圖函式庫）或其他符合專題部署條件的服務。這個選擇只影響使用者前台如何顯示圖層、如何讓使用者點選位置，以及是否需要服務商的金鑰；資料庫仍只保存 QMAH 需要的地點文字與座標。若引入需要金鑰的圖磚或地理編碼服務，金鑰應放在 Angular 前端的部署設定或後端受保護設定，不放進 API 回應與版本庫。

選點表單建議遵循以下資料流程：

```text
地圖選點或地址輸入
        ↓
使用者前台保留 location／locationName／addressLine
        ↓
前台寫入成對 latitude、longitude
        ↓
API 驗證範圍與成對規則
        ↓
資料庫保存地點文字與座標
```

地址文字與座標的用途不同：文字用於閱讀、搜尋與沒有地圖時的備援；座標用於定位、標記與路線入口。兩者都存在時，前台仍應優先顯示文字地址，再提供地圖操作。

## 與圖片 CDN 的界線

地圖資料與圖片交付是兩條獨立流程。文物、商品與公開圖片依 [`17-media-delivery.md`](17-media-delivery.md) 的 `Media` 設定解析本機或 CDN（內容傳遞網路）網址；活動與地址的地點欄位不會因圖片改放 Azure Blob、Azure Front Door、Cloudflare Proxy 或 Cloudflare R2 而改寫。

前台可以同時使用：

- API 回傳的圖片 `URL（資源網址）` 顯示文物或商品
- API 回傳的地點文字與座標顯示地點
- OpenStreetMap 連結或前台選用的地圖元件處理地圖操作

切換圖片來源時只需依媒體文件調整圖片網址解析與檔案同步；地圖串接仍讀取原本的 `location`、`locationName`、`latitude` 與 `longitude`。

## 實作時的檢查項目

- 事件、貼文或地址的兩個座標同時存在，或同時為 `null`
- 不以城市中心、固定常數或字串猜測缺少的座標
- 線上活動使用 `線上活動`，不產生地圖標記
- 沒有座標時保留地點文字與地址搜尋入口
- 地圖服務的金鑰、圖磚網址與服務商設定由前台部署環境管理
- 公開貼文只顯示 API 已公開的地點資料；會員地址依 `/api/v1/me/addresses` 的登入權限使用
- 地圖操作失敗時仍顯示地點文字，不影響活動、貼文或地址的主要流程
