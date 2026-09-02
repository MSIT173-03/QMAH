# 期末前端使用者前台開發交接

本文件是 QMAH 期末前端使用者前台開發的共同入口。前端畫面使用 `QMAH.Client` 的 Angular 21.2.22，使用者前台透過 `QMAH.Api` 後端的 `/api/v1` JSON 契約取得資料與執行操作；資料庫、Identity（登入與會員驗證元件）、圖片網址與跨系統規則由 `QMAH.Infrastructure` 後端共用。完整欄位與狀態碼以 [`REST API 契約`](13-rest-api.md) 和 API 啟動後的 [OpenAPI JSON](https://localhost:7249/openapi/v1.json) 為準。

## 四個詞的分工

後端（backend）與前端（frontend）描述技術層；前台（front office）與後台（back office）描述使用對象。QMAH 的對應如下：

| 技術與使用情境 | QMAH 對應 |
| --- | --- |
| 後端 | `QMAH.Api`、`QMAH.Infrastructure`，以及 `QMAH.Web` 內執行於伺服器的 Controller 與 Service |
| 前端 | `QMAH.Client` 的 Angular，以及 `QMAH.Web` 的 Razor、HTML、CSS 與 JavaScript |
| 使用者前台 | `QMAH.Client` Angular 前端呈現的一般訪客與會員介面 |
| 管理後台 | `QMAH.Web` Razor 前端呈現的管理員、內容編輯與營運介面 |

`QMAH.Web` 是包含 Razor 前端管理後台的 ASP.NET Core 後端主機；`QMAH.Api` 是提供 JSON 的後端 API 主機；`QMAH.Client` 是呼叫後端 API 的 Angular 前端使用者前台。

## 開發入口

本機資料庫使用最新 Release 的 `.bak`，或在 SSMS 執行 [`database/QMAH.sql`](../database/QMAH.sql)，完成其中一種還原即可。前端開發第一次使用時，在 `QMAH.Client` 執行：

```powershell
npm ci
```

API 與 Angular 可以透過下列方式啟動：

| 方式 | 操作 |
| --- | --- |
| Visual Studio | 使用 `QMAH 後端主機與管理後台（API＋Razor）` 檢查後端 API 與資料庫，或使用 `QMAH API` 單獨啟動後端 API |
| VS Code | 使用 `QMAH 使用者前台開發（API 後端＋Angular 前端）` 同時啟動，或分別使用 `QMAH API（https）` 與 `QMAH Angular 前端使用者前台` |
| 命令列 | API 執行 `dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile https`，另一個終端機在 `QMAH.Client` 執行 `npm start` |

瀏覽器開啟 `http://localhost:4200/`。Angular 前端使用 `/api/v1` 相對路徑，開發伺服器由 `QMAH.Client/proxy.conf.json` 將 `/api`、`/openapi` 與 `/scalar` 轉送到後端 API，因此 component（畫面元件）不保存固定 API 連接埠。建置與測試命令見 [`Angular 前端的使用者前台開發起點`](12-frontend-start-guide.md)。

## 第一條資料流程

使用者前台可依下列順序建立登入後的應用程式資料流：

1. 呼叫 `GET /api/v1/account/antiforgery-token`，取得 API 的 Anti-forgery（防偽請求驗證）Cookie。
2. 呼叫 `POST /api/v1/account/login`，body 使用 `Email`、`Password`、`RememberMe`。
3. 登入成功後呼叫 `GET /api/v1/me`，取得目前會員資料、角色與點數。
4. 會員使用者前台確認登入完成後，再呼叫 `POST /api/v1/me/daily-activity/login` 記錄當日登入；營運管理後台登入不使用這個流程。
5. 呼叫 `GET /api/v1/metadata`，將 API 回傳的 `Code` 與中文 `Label` 用於篩選器、表單與顯示文字。

後端 API 使用 HttpOnly Cookie 保存登入狀態。Angular 的 `HttpClient` 已集中設定 `withCredentials`；所有 POST、PUT、DELETE 沿用 `X-XSRF-TOKEN` Header。前端不把密碼、Cookie、Token 或 API 網域寫進 localStorage；登入與寫入資料只依後端 API 契約送出。

## 功能開發順序

每個功能以 `features/<feature>` 分層，畫面只處理顯示與使用者操作，API 呼叫、資料轉換與錯誤處理集中在 service。下表提供使用者前台接手順序與第一批契約：

| 功能 | 主要 API | 前台需要組合的資料 |
| --- | --- | --- |
| 帳號與會員 | `/account/*`、`/me`、`/me/profile`、`/me/notifications`、`/me/daily-activity` | 登入狀態、會員資料、通知、登入進度 |
| 圖鑑 | `/metadata`、`/catalog/artifacts`、`/catalog/artifacts/{id}`、`/catalog/categories`、`/catalog/eras` | 搜尋、分類與年代篩選、文物詳情、圖片與授權文字 |
| 社群與活動 | `/social/posts`、`/social/posts/{id}`、`/social/events`、`/social/events/{id}`、留言與報名 API | 貼文、留言、活動狀態、報名人數、地點與活動圖片 |
| 多人遊戲 | `/game/rooms`、`/game/rounds/{id}`、作答、投票、`/game/rooms/{id}/history` | 房間、玩家、回合、答案、票數、勝者與排行榜 |
| Mini Game | `/game/modes`、`/game/attempts`、`/game/attempts/{id}/complete` | 伺服器決定的文物池、Seed（結果重現用的隨機種子）、難度、評級與獎勵 |
| 鑰匙與點數 | `/me/economy`、`/me/keys/*`、`/game/rooms/{id}/reward` | 鑑定點數、鑰匙餘額、可解鎖數量、兌換與回收結果 |
| 優惠券與稱號 | `/me/coupons/*`、`/me/achievements`、`/me/title` | 可兌換優惠券、優惠券期限與狀態、成就與目前配戴稱號 |
| 商城 | `/store/products`、`/store/products/{id}/reviews`、`/me/cart`、`/store/orders`、`/me/addresses` | 商品、評價、購物車、地址、訂單與折扣結果 |
| 私人房間與活動加碼 | `/game/invitations`、`/game/rooms/{id}/invitations`、各 reward-policy API | 邀請狀態、會員加碼、預算剩餘量與接受後的發放結果 |

各 API 的完整 request body、response DTO、權限與錯誤狀態由後端契約定義，直接查閱 [`REST API 契約`](13-rest-api.md) 或 Scalar。使用者前台不依賴 Entity、資料表名稱或管理後台 ViewModel。

## 回應與錯誤處理

清單回應統一使用 `items`、`page`、`pageSize`、`totalCount`、`totalPages`。空清單是正常狀態，`totalPages` 為 `0` 時保留空畫面與重新整理入口。日期使用 API 的 ISO 8601（國際標準日期時間文字格式）值，顯示格式由前台集中處理。

成功回應依操作處理 `200`、`201`、`202` 與 `204`，不可假設所有成功都會有 JSON body。錯誤依 `ProblemDetails`（標準錯誤回應格式）與 `ValidationProblemDetails`（欄位驗證錯誤格式）處理：

| 狀態 | 使用者前台行為 |
| ---: | --- |
| `400` | 顯示欄位或流程條件錯誤，保留可修正的輸入 |
| `401` | 清除使用者前台會員狀態並導向登入流程 |
| `403` | 顯示目前帳號沒有此操作權限 |
| `404` | 顯示資源不存在或目前不可見 |
| `409` | 顯示餘額、狀態、名額、重複操作或版本衝突 |
| `413` | 顯示上傳檔案大小超過限制 |
| `429` | 保留目前輸入，提示稍後再試 |
| `500`／`503` | 顯示服務暫時無法使用，保留重新整理或重試入口 |

錯誤畫面使用 `title` 與 `detail` 的可讀內容，不顯示 Controller 名稱、資料庫名稱、例外堆疊或檔案路徑。送出按鈕在 request 完成前維持載入狀態，避免同一操作重複送出。

## 圖片與地圖

文物與商品的 `PrimaryImagePath`、`ThumbnailPath` 已由後端 API 解析成目前環境可使用的網址。使用者前台直接把它當作 `img` 的 `src`，不從 `ArtifactId`、分類代碼或檔名自行拼接路徑；圖片來源從 Local 切換到 Azure Front Door、Cloudflare 或其他 CDN 時，前端元件不需要改動。完整規則見 [`媒體交付設定`](17-media-delivery.md)。

社群圖片使用 API 回傳的 `SocialMediaDto.Url`，受保護的內容仍透過 `/api/v1/social/media/{id}/content` 取得。圖片載入失敗、沒有縮圖或沒有替代文字時，畫面保留可理解的替代狀態；`AltText` 用於圖片替代文字。

地圖只使用後端 API 回傳的 `location`、`locationName`、`addressLine`、`latitude` 與 `longitude`。座標成對存在時可產生定位連結，只有文字時使用地址搜尋，兩者皆無時保留地點未提供狀態。QMAH 不需在使用者前台或資料庫保存地圖圖磚資料；完整欄位與簡單串接方式見 [`地點與地圖串接說明`](18-map-integration.md)。

## 建議的 Angular 分層

```text
src/app/
├─ core/
│  ├─ api/              # API client、ProblemDetails、分頁與共用 DTO 型別
│  ├─ auth/             # 登入狀態、Anti-forgery 與會員 session
│  └─ http/             # credentials、錯誤轉換與共用 interceptor
├─ shared/              # 可跨功能重用的表單、載入、空資料、錯誤與圖片元件
├─ features/            # catalog、social、game、economy、store、member 等功能
└─ app.routes.ts        # lazy loading 功能路由集中入口
```

`core` 只放全站共用服務，`shared` 只放可重用的顯示元件，業務規則放在對應的 `features` service。使用者前台功能先以後端 API DTO 建立型別，再由 service 轉成畫面需要的資料；不用把資料庫 Entity 複製到 Angular。

## 完成功能前的檢查

- 本機使用 `QMAH` 資料庫，API 與 Angular 都能由 GUI 或命令列啟動。
- 前端 API 呼叫使用 `/api/v1` 相對路徑，沒有把本機連接埠寫進 component。
- 登入後的 request 帶 Cookie；寫入前已取得 Anti-forgery Cookie。
- 清單有載入中、空資料、分頁與錯誤狀態，寫入有成功與重複送出處理。
- 圖片直接使用後端 API 網址，地圖直接使用後端 API 地點欄位。
- 經濟數值、鑰匙比例、優惠券門檻、評級與有效期限都取自後端 API，不在使用者前台寫死。
- 完成後以 Scalar 的 Test Request、瀏覽器 Network、Angular build 與測試檢查實際 request／response。
