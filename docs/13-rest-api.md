# REST API 契約

QMAH API 位於獨立的 `QMAH.Api` 專案，所有版本化 Endpoint 以 `/api/v1` 開頭。API 與 Razor 後台共用 `QMAH.Infrastructure`、Identity 與 SQL Server，不複製 Entity 或建立第二個資料庫。

開發環境 API：`https://localhost:7249`。Development 才提供 `/openapi/v1.json` 與 `/scalar/v1`；前台平常透過 Angular proxy 使用相對路徑 `/api/v1`。

## 共通回應

分頁 Endpoint 回傳：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0,
  "totalPages": 0
}
```

`page` 從 1 開始，`pageSize` 會限制在 1 至 100；沒有資料時 `totalPages` 為 0、`page` 為 1。前台不要自行猜總頁數或把空集合當成錯誤。

錯誤使用 RFC 7807 `ProblemDetails`／`ValidationProblemDetails`，常見狀態如下：

| 狀態 | 意義 |
| ---: | --- |
| 201 | 已建立新資源，回應包含建立結果 |
| 202 | 已接受要求並進入後續處理，不代表處理已完成 |
| 204 | 操作成功且沒有回應內容 |
| 400 | 輸入格式、欄位或流程條件不符合 |
| 401 | 尚未登入或登入狀態失效 |
| 403 | 已登入但沒有該操作權限 |
| 404 | 找不到資源或資源目前不可見 |
| 409 | 與既有資料衝突，例如 Email 已存在 |
| 413 | 上傳內容超過端點允許的大小 |
| 500／503 | 服務或外部資料來源暫時失敗 |

畫面顯示 `title` 與 `detail` 的友善內容，不要把 Controller 名稱、資料表名稱、例外堆疊或內部路徑直接展示給使用者。

## 存取與驗證

| 類別 | 規則 |
| --- | --- |
| 公開讀取 | 圖鑑、商品、公開貼文、已發布活動、公告貼文、公開遊戲房間與 metadata |
| 登入後讀取 | `/api/v1/me/*`、私人遊戲房間與個人資料 |
| 登入後寫入 | 遊戲建立／加入／作答／投票、建立活動／貼文／留言／檢舉、圖片與訂單 |
| 管理員 | `/api/v1/admin/dashboard` |

登入成功後 API 以 Cookie 保存狀態，不回傳自製 JWT。Angular 請保留 credentials；直接跨來源呼叫時，來源必須列在 API 的 `Cors:AllowedOrigins`，不可改成任意來源。

所有 POST、PUT、DELETE 先呼叫 `GET /api/v1/account/antiforgery-token`，再帶 `X-XSRF-TOKEN` Header。GET 不需要 Anti-forgery token。

## Endpoint 清單

### 帳號

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/account/antiforgery-token` | 公開 | 設定瀏覽器 Anti-forgery Cookie |
| POST | `/api/v1/account/login` | 公開 | Email／密碼登入，成功 204 |
| POST | `/api/v1/account/logout` | 登入後 | 登出並清除登入 Cookie |
| POST | `/api/v1/account/register` | 公開 | 建立會員與 Profile |
| POST | `/api/v1/account/forgot-password` | 公開 | 寄送或模擬寄送密碼重設指示；不透露 Email 是否存在 |
| POST | `/api/v1/account/reset-password` | 公開 | 使用重設 Token 更新密碼 |

### metadata、圖鑑與商城

| Method | Path | 參數／用途 |
| --- | --- | --- |
| GET | `/api/v1/metadata` | 取得分類、年代、貼文板塊、貼文／活動／媒體選項與中文 Label |
| GET | `/api/v1/catalog/artifacts` | `q`、`categoryCode`、`eraCode`、`page`、`pageSize`；只回傳啟用文物 |
| GET | `/api/v1/catalog/artifacts/{id}` | 文物詳情、來源授權、圖片與是否有題庫／商品 |
| GET | `/api/v1/catalog/categories` | 圖鑑分類 |
| GET | `/api/v1/catalog/eras` | 年代篩選 |
| GET | `/api/v1/store/products` | `q`、`categoryCode`、`artifactId`、`page`、`pageSize`；只回傳上架商品 |
| GET | `/api/v1/store/products/{id}` | 商品詳情與對應文物 |
| GET | `/api/v1/store/products/{productId}/reviews` | 公開評價分頁、平均星等與評價總數；只計入已發布內容 |
| GET | `/api/v1/store/products/{productId}/reviews/me` | 登入後取得目前會員對該商品的評價 |
| PUT | `/api/v1/store/products/{productId}/reviews/me` | 登入後新增或修改目前會員的 1 至 5 星評價與短文 |
| DELETE | `/api/v1/store/products/{productId}/reviews/me` | 登入後刪除目前會員自己的評價；採軟刪除，不影響其他會員的內容 |

Code 是資料契約，不是直接給使用者看的文案；前台應以 metadata 的 Label 呈現。文物圖片與商品圖片使用既有 `/media/catalog/` 路徑及其來源授權資料。

### 社群、公告與活動

| Method | Path | 參數／用途 |
| --- | --- | --- |
| GET | `/api/v1/social/posts` | `q`、`boardCode`、`postType`、`artifactId`、`page`、`pageSize`；公開貼文清單 |
| GET | `/api/v1/social/posts/{id}` | 貼文全文、公開留言與可用社群圖片 |
| GET | `/api/v1/social/announcements` | 公告貼文清單；公告是貼文類型，不是另一個編輯資料源 |
| GET | `/api/v1/social/events` | 已核准且已發布活動清單與報名人數 |
| GET | `/api/v1/social/events/{id}` | 活動詳情、座標、名額與目前帳號是否已報名 |
| POST | `/api/v1/social/events` | 登入後建立玩家／官方活動；活動可選模板或自訂活動貼文內容 |
| POST | `/api/v1/social/events/{id}/registration` | 登入後報名活動 |
| DELETE | `/api/v1/social/events/{id}/registration` | 取消目前帳號的活動報名 |
| POST | `/api/v1/social/posts` | 登入後建立一般貼文或公告貼文，可關聯文物、座標與社群圖片 |
| POST | `/api/v1/social/posts/{postId}/comments` | 登入後新增留言或回覆 |
| POST | `/api/v1/social/reports` | 登入後檢舉公開貼文／留言 |

活動是獨立資料，活動通過審核與發布後會有對應的活動貼文；一般公告則是 `SocialPosts` 的公告貼文類型。地址／地點可只填文字，也可同時提供成對的 `latitude` 與 `longitude`，不要求前台只能使用地圖。

### 社群媒體

| Method | Path | 權限／用途 |
| --- | --- | --- |
| POST | `/api/v1/social/media` | 登入後以 `multipart/form-data` 上傳；`file` 為必填 binary 圖片、`altText` 為選填替代文字；支援 JPEG／PNG／GIF／WebP，最大 8 MB，超過回傳 413 |
| GET | `/api/v1/social/media/{id}/content` | 公開已發布貼文的可用圖片；擁有者可預覽尚未關聯圖片 |
| DELETE | `/api/v1/social/media/{id}` | 圖片擁有者軟刪除自己的圖片 |

社群圖片使用永久流水號，API 回傳受控 URL；前台不自行拼檔名、不讀取實體資料夾，也不把原始檔名當成 HTML 或路徑。官方文物圖鑑圖片不屬於這組社群上傳 Endpoint。

### 遊戲

| Method | Path | 權限／用途 |
| --- | --- | --- |
| GET | `/api/v1/game/rooms` | 公開房間清單；可用 `status`、`page`、`pageSize` 篩選 |
| GET | `/api/v1/game/rooms/{id}` | 公開／參與中的房間詳情 |
| POST | `/api/v1/game/rooms` | 登入後建立房間 |
| POST | `/api/v1/game/rooms/{id}/join` | 登入後加入房間 |
| POST | `/api/v1/game/rounds/{id}/answers` | 回答中的回合送出答案 |
| POST | `/api/v1/game/rounds/{id}/votes` | 投票中的回合送出投票 |
| GET | `/api/v1/game/rounds/{id}` | 登入後取得回合與答案詳情 |
| GET | `/api/v1/game/rooms/{id}/history` | 房間的回合歷程、每回合答案／票數／勝者與整場排行榜 |

遊戲 API 不把內部 `PlayerKey` 回傳給前台；使用 DTO 的玩家 Id、顯示名稱與狀態即可。答案類型與房間狀態需使用 metadata／API 文件中的允許值，不要在畫面散落自行定義的字串。

回合詳情與房間歷程會依投票總數、送出時間與答案 Id 產生穩定排名；只有已結算且至少有一票的第一名會標示為勝者。排行榜以各回合收到的票數累計分數，並同時提供作答回合數與獲勝回合數，讓前台可以製作單場結算和長期回顧，不必自行重算既有資料。

### 目前會員與商城操作

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/v1/me` | 取得目前會員資料 |
| PUT | `/api/v1/me/profile` | 更新目前會員 Profile |
| GET | `/api/v1/me/orders` | 查詢目前會員訂單 |
| GET | `/api/v1/me/orders/{id}` | 取得目前會員訂單明細 |
| GET | `/api/v1/me/coupons` | 目前帳號的優惠券 |
| GET | `/api/v1/me/posts` | 目前帳號自己的貼文 |
| GET | `/api/v1/me/achievements` | 目前帳號的成就 |
| GET | `/api/v1/me/cart` | 取得購物車 |
| POST | `/api/v1/me/cart` | 加入購物車商品 |
| PUT | `/api/v1/me/cart/{productId}` | 更新購物車商品數量 |
| DELETE | `/api/v1/me/cart/{productId}` | 移除購物車商品 |
| GET | `/api/v1/me/addresses` | 查詢地址 |
| POST | `/api/v1/me/addresses` | 建立地址 |
| PUT | `/api/v1/me/addresses/{id}` | 修改地址 |
| DELETE | `/api/v1/me/addresses/{id}` | 刪除地址 |
| POST | `/api/v1/me/addresses/{id}/default` | 設為預設地址 |
| GET | `/api/v1/me/notifications` | 查詢通知 |
| POST | `/api/v1/me/notifications/{id}/read` | 標記通知已讀 |
| POST | `/api/v1/store/orders` | 依目前帳號購物車資料建立訂單 |
| POST | `/api/v1/store/orders/{id}/cancel` | 取消目前帳號仍可取消的訂單 |

「目前會員」由登入 Cookie 決定，前台不能從 request body 自行指定另一個 UserId。地址可以手動輸入，座標欄位可完全留白或成對提供。

### 管理摘要

| Method | Path | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/dashboard` | Admin | 目前會員、文物、題庫、社群、活動、訂單、營收與熱門商品摘要 |

更長期的逐日／逐月營運檢視目前由 Razor 後台的「營運中心」提供，避免為同一個管理頁維護兩套統計查詢；未來真的需要前台管理介面時再依這個資料邊界擴充。

## 前台使用原則

- 先使用 DTO 與 metadata，不直接依賴 Entity 或資料庫欄位名稱。
- 所有清單保留 loading、空資料、分頁與錯誤狀態。
- 使用者輸入的貼文、留言與商品描述以純文字安全呈現，不使用未清理的 HTML。
- 寫入操作處理 401、403、409 與 ValidationProblemDetails，不能只看 HTTP 200。
- 日期使用 API 傳回的 ISO 8601 值；顯示格式由前台統一處理，不改變原始時間。
