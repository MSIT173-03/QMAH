# 測試怎麼選

這是已完成展示的專題，測試的價值在於擋住實際回歸，不在案例數。不要為了把數字變小，合併成一個巨型測試；也不要為每個元件各複製一份只有 `toBeTruthy()` 的檔案。

## 日常檢查

| 這次改什麼 | 最小有效檢查 | 主要風險 |
| --- | --- | --- |
| 登入、讀取與商城共用流程 | 前台 `npm run test:critical` | 錯誤保留登入、過期登入沒清除、寫入被自動重送、訂單／付款顯示錯誤、惡意留言標記 |
| 單一前台功能或元件 | `npm test -- --watch=false --include=<相關 spec 路徑>`，再建置 | 只跑受影響的使用者互動，不為修一個文字跑完整套件 |
| API 路由、Cookie、權限、中介軟體 | `dotnet run --project tools/ApiVerification/ApiVerification.csproj -c Release` | 401/403、CSRF、CORS、偽造票證、限流與過載恢復 |
| 點數、鑰匙、交易重試 | `dotnet run --project tools/ResilienceChecks/ResilienceChecks.csproj -c Release` | 同一次操作重複扣款／扣鑰匙、帳本與餘額不一致 |
| 信箱驗證或綠界簽章 | `AccountVerificationChecks` 或 `EcpayChecks` 工具 | 錯用 token、繞過驗證、簽章錯誤；使用替身，不真正寄信或付款 |
| 套件變更 | [套件稽核](security-maintenance.md) | 公開通報、開發工具與間接依賴風險 |
| 讀取效能、併發與流量保護 | [隔離壓測](performance.md) | 重複查詢、冷快取突波、過載時先壓到登入資料庫 |

### 最小前台風險組

`npm run test:critical` 只把下列既有行為群組作為日常快捷入口。它是新增的選用命令，**不取代既有完整 CI，也沒有把其他測試標記 skip 或 exclude**。

| 檔案 | 保護的行為 |
| --- | --- |
| `core/guards/auth-guard.spec.ts` | 真正呼叫 guard；登入通過，401/403 清狀態並保留目的地，503 只容許已驗證工作階段 |
| `core/services/api-read-deadline.spec.ts` | 逾時讀取可以中止，結帳寫入不被逾時機制自動重送 |
| `core/services/notification-live.spec.ts` | 切換帳號與登出關閉舊通知連線，避免沿用別人的連線 |
| `features/auth/login/login.spec.ts` | 登入失敗處理、重複送出與登入後導向 |
| `features/member/economy/economy.spec.ts` | 會員資產畫面與操作狀態 |
| `store/pages/checkout/checkout.spec.ts` | 付款方式、地址與送單 |
| `store/pages/orders/orders.spec.ts` | 訂單金額、付款狀態與安全的操作回饋 |
| `shared/social-markup.spec.ts` | 社群內容的標記轉換與不安全內容處理 |

路徑皆相對於 `QMAH.Client/src/app/`。改動其他功能時仍應執行該功能的既有測試，不要把這個清單當成全站測試範圍。

## 這次怎麼簡化

17 份只有初始化斷言的測試，移到 `component-smoke.spec.ts` 的共用資料表。**17 個原斷言與原本需要的 Router provider 都保留**；移除的是重複的 imports、變數、beforeEach 與 fixture 設定，不是頁面的檢查。

| 合併項目 | 原本的位置 |
| --- | --- |
| 忘記／重設密碼 | `features/auth/{forgot-password,reset-password}/*.spec.ts` |
| 會員成就與地址 | `features/user/{achievements,addresses}/*.spec.ts` |
| 頁尾 | `shared/components/site-footer/site-footer.spec.ts` |
| 商城小元件 | `store/component/{breadcrumb,empty-state,page-title-row,panel,pill-group,qty-stepper,section-head}/*.spec.ts` |
| 購物車子元件 | `store/pages/cart/{cart-addons,cart-line,cart-summary}/*.spec.ts` |
| 本地查詢服務 | `services/{catalog-service,key-service}.spec.ts` |

原本 authGuard 的測試只斷言一個函式存在，沒有執行 guard，因此無法發現登入保護失效。這項改成前面列出的實際登入情境；沒有用只確認函式名稱的測試冒充權限測試。

付款、訂單、資產、非同步競態與過期登入的既有行為測試保留。不把各種狀態塞進一個 `it` 來假裝減少案例，也不因新套件使測試失敗就刪除斷言。

## API 與基本資安

`ApiVerification` 使用真正的 API `Program`、Kestrel loopback TCP、Identity 票證驗證、CORS、防偽與授權中介軟體。它沒有另寫一份假的 API 讓測試自動通過。

- 用臨時 SQLite 建立合成分類、年代與會員；啟動入口之前就關閉 SQL Server 自動探索。
- 只監聽 loopback 的隨機埠，不接受外部 URL。用可信 loopback 代理的標頭模擬 TLS 終止，並保留 Secure Cookie 的產品設定。
- 停用本輪測試不需要的寄信、AI、到期訂單與通知背景工作；不接 Azure、Google、Logto 或付款服務。
- 驗證匿名可讀公開資料、私人 API 401、普通會員管理 API 403、偽造票證拒絕、無 CSRF 的已登入寫入被擋、未允許來源無法取得 CORS 授權。
- 驗證同一 IP 下不同會員不共用發文額度，429 有 CORS 與 Retry-After，過載在登入資料庫查詢前被擋下，容量釋放後可恢復。
- 驗證冷快取突波只查分類與年代各一次；不是用固定的假成功回應代替資料庫。

SQLite 不等於 SQL Server；這組測試不驗證 SQL Server 死結、索引效能、真實信件送達或第三方 OAuth。也不是完整滲透測試。

## CI 與執行頻率

- 每次 PR／main、develop push：沿用完整前端測試與建置；後端另外執行帳號、付款、API 取消、帳本一致性與隔離 API 風險檢查。既有驗證範圍沒有縮小。
- 改套件或每週：npm／NuGet 弱點稽核，包含開發與間接依賴。
- 改部署腳本：一般 Build 的 Linux job 執行 POSIX 腳本測試，不登入 Azure。
- 壓測不在每個 PR 強制跑，也不把本機 RPS 當成會受環境影響的 CI 成敗條件。需要時執行 CLI，或在 Build 手動啟動時勾選 `run-load`。

要新增測試，先寫明「哪個可觀察的失敗會讓它失敗，以及失敗後會怎麼處理」。例如快取少了合併載入會增加查詢數、把會員額度限流移到登入前會混用同一 IP 的額度、在登入後才做總量門禁會使超量請求先查資料庫。若只能斷言剛新增的常數或私有方法本身，通常不需要新增測試。
