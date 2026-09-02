# API 名詞表

本名詞表統一 QMAH API 文件中的專業用語、英文原文與台灣繁體中文說明。每個 OpenAPI operation（一次 API 呼叫）仍會在自身的 `summary`（清單短摘要）或 `description`（完整行為說明）中就地補上括號，不依賴整份文件的閱讀順序。

## 使用規則

1. API 條目視為可以獨立閱讀的文件；條目內出現的專業術語，在同一條目中直接使用「原文（白話說明）」格式。
2. 同一術語固定使用本表的說法，不在不同 Controller 或文件段落另造同義詞。
3. 程式欄位名稱、路徑、允許值與 HTTP 方法保留原文；原文後補充其用途或資料意義。
4. `summary` 保持短句；需要解釋的內容放在 `description`、參數說明或 Schema（資料欄位格式）中。

## 後端、前端與前台／後台

這四個詞分別描述技術層與使用情境，文件中不互相替代：

| 詞 | 定義 | QMAH 對應 |
| --- | --- | --- |
| 後端（backend） | 在伺服器端執行 API、Service、驗證、資料存取與檔案處理的程式 | `QMAH.Api`、`QMAH.Infrastructure`，以及 `QMAH.Web` 的 Controller 與 Service |
| 前端（frontend） | 與使用者瀏覽器互動的畫面、元件、樣式與瀏覽器端程式 | `QMAH.Client` 的 Angular，以及 `QMAH.Web` 的 Razor、HTML、CSS 與 JavaScript |
| 前台（front office） | 一般訪客與會員使用的產品介面 | `QMAH.Client` Angular 前端所呈現的使用者前台 |
| 後台（back office） | 管理員、內容編輯與營運人員使用的管理介面 | `QMAH.Web` Razor 前端所呈現的管理後台 |

`QMAH.Web` 同時包含後端主機程式與 Razor 前端管理後台；`QMAH.Api` 是後端 API 主機；`QMAH.Client` 是前端使用者前台。啟動設定名稱若同時啟動多個主機，會直接標示 API 後端、Razor 管理後台與 Angular 使用者前台。

## 共通術語

| 術語 | 文件中的統一寫法 | 說明 |
| --- | --- | --- |
| API | `API（應用程式介面）` | 提供其他程式呼叫的功能入口 |
| REST API | `REST API（以 HTTP 資源路徑提供資料與操作的 API）` | 以 HTTP 方法與資源路徑表達查詢或寫入行為 |
| Endpoint | `Endpoint（API 可呼叫的路徑）` | 一組 HTTP 方法與 URL 路徑的組合 |
| OpenAPI | `OpenAPI（API 的標準契約格式）` | 描述路徑、參數、請求、回應與驗證方式的機器可讀文件 |
| Scalar | `Scalar（互動式 API 文件頁面）` | 讀取 OpenAPI 文件並提供參數填寫與測試呼叫的介面 |
| operation | `operation（一次 API 呼叫）` | OpenAPI 中代表一個 HTTP 方法與路徑的項目 |
| `summary` | ``summary（清單中的短摘要）`` | 在 API 清單中快速辨識用途的一行文字 |
| `description` | ``description（完整行為說明）`` | 說明輸入、輸出、權限、流程條件與錯誤的文字 |
| `operationId` | ``operationId（穩定且唯一的 API 識別名稱）`` | 供測試工具或程式碼產生工具辨識 operation |
| schema | `Schema（資料欄位格式）` | 定義 JSON 或表單資料的欄位、型別、限制與巢狀結構 |
| request body | `request body（請求本文，送出的 JSON 內容）` | POST、PUT 等寫入操作送給 API 的資料 |
| response body | `response body（回應本文）` | API 回傳的 JSON 或其他內容；204 通常沒有 response body（回應本文） |
| path parameter | `path parameter（路徑參數）` | 放在網址大括號中的資源識別欄位，例如 `{id}` |
| query string | `query string（查詢參數）` | 放在網址 `?` 後的篩選、搜尋或分頁欄位 |
| status code | `status code（HTTP 狀態碼）` | 表示請求結果，例如 200、400、401 或 404 |
| ProblemDetails | `ProblemDetails（RFC 7807 標準錯誤回應格式）` | 以 `type`、`title`、`status`、`detail` 等欄位描述錯誤 |
| ValidationProblemDetails | `ValidationProblemDetails（欄位驗證錯誤格式）` | ProblemDetails（標準錯誤回應格式）的延伸格式，另可包含 `errors` 欄位 |
| DTO | `DTO（API 對外傳輸的資料格式）` | API 對外提供的資料結構，不等同於資料庫 Entity |
| Entity | `Entity（資料庫對應模型）` | 由 ORM（物件關聯對映工具）追蹤並對應資料表的程式模型 |
| metadata | `metadata（供前端使用的選項資料）` | 例如分類、狀態與類型的 code（系統代碼）／Label（畫面顯示文字）對照 |
| code | `code（系統代碼）` | 程式判斷使用的穩定值，不直接當作畫面文案 |
| Label | `Label（畫面顯示文字）` | 提供給使用者閱讀的中文名稱 |
| Id | `Id（資源識別碼）` | 多數資源使用 GUID（全域唯一識別碼）表示 |
| GUID | `GUID（全域唯一識別碼）` | 用來唯一識別會員、文物、商品、訂單等資源的值 |

## 驗證、瀏覽器與請求

| 術語 | 文件中的統一寫法 | 說明 |
| --- | --- | --- |
| Cookie | `Cookie（瀏覽器保存的小型資料）` | 由瀏覽器保存並在後續請求自動帶回 API 的資料 |
| Identity Cookie | `Identity Cookie（登入狀態 Cookie）` | ASP.NET Core Identity（登入與會員驗證元件）保存登入狀態使用的 Cookie（瀏覽器保存的小型資料） |
| session | `session（瀏覽器工作階段）` | 同一個瀏覽器分頁或測試工具保留 Cookie 與登入狀態的期間 |
| Anti-forgery | `Anti-forgery（防偽請求驗證）` | 降低其他網站冒用已登入瀏覽器發送寫入請求的驗證機制 |
| Header | `Header（HTTP 標頭）` | 放在 HTTP 請求或回應中的控制資訊，例如 `X-XSRF-TOKEN` |
| credentials | `credentials（是否攜帶 Cookie 的請求設定）` | 前端跨來源呼叫時控制瀏覽器是否附帶登入 Cookie |
| CORS | `CORS（跨來源資源共用）` | 瀏覽器限制不同來源互相呼叫時使用的伺服器規則 |
| JSON | `JSON（常用的結構化資料格式）` | API 傳遞物件與清單時使用的文字資料格式 |
| token | `token（驗證用的暫時字串）` | 例如防偽請求 token（驗證用的暫時字串）或密碼重設 token（密碼重設驗證字串） |
| Email enumeration | `Email enumeration（由回應推測帳號是否存在）` | 透過不同回應判斷某個 Email 是否註冊的資訊洩漏 |

## 媒體、分頁與部署

| 術語 | 文件中的統一寫法 | 說明 |
| --- | --- | --- |
| multipart/form-data | `multipart/form-data（表單檔案上傳格式）` | 同一個 HTTP 請求同時傳送檔案與文字欄位的格式 |
| binary | `binary（原始檔案內容）` | 以位元組形式傳送的圖片或其他檔案資料 |
| altText | `altText（圖片替代文字）` | 圖片無法顯示或需要輔助閱讀時使用的文字 |
| URL | `URL（資源網址）` | 指向 API、圖片或前端頁面的網址 |
| HTTP range request | `HTTP range request（HTTP 分段讀取請求）` | 只讀取檔案部分位元組，適合圖片預覽與續傳 |
| pagination | `pagination（分頁）` | 將大量清單拆成多頁回傳的方式 |
| soft delete | `soft delete（保留資料的刪除標記）` | 保留資料與關聯，只將資源標記為不可用 |
| CDN | `CDN（內容傳遞網路）` | 從鄰近節點提供靜態圖片等檔案的服務 |
| fallback | `fallback（主要設定失效時的備援選擇）` | 主要來源無法使用時依序嘗試其他可用來源 |

## 文件維護

OpenAPI 的 `summary` 與 `description` 使用 [OpenAPI 3.1 Operation Object](https://spec.openapis.org/oas/v3.1.0#operation-object) 的分工；HTTP 狀態碼使用 [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) 的語意。新增術語時先補入本表，再在對應的 operation 描述、參數或 Schema 補上同一組括號說明。
