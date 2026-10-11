# Azure 專題展示部署

使用獨立的 Azure x64 主機提供 Angular 前台、API、MVC 後台與 SQL Server Express。
展示環境使用 QMAH-Database 的 `db-v1.0.0` 發行備份，本機資料庫不改動。

## 線上入口

- 前台：https://qmah.eastus.cloudapp.azure.com/home
- 管理後台：https://qmah.eastus.cloudapp.azure.com/admin/
- 固定單台 Azure East US VM，2 vCPU、8 GB RAM、64 GB Standard SSD。
- Angular 靜態檔、API、Razor 後台與 SQL Server Express 部署在同一台主機。

## 部署設定

- Kestrel 只監聽 loopback，由 HTTPS 反向代理提供公開入口。
- `Hosting:ForwardedHeadersEnabled=true`，只信任同機 loopback 代理的一層標頭。
- 後台 `Hosting:PathBase=/admin`，前後台同網域。
- 兩個 ASP.NET Core 主機使用同一個 `DataProtection:KeysPath`，重新啟動仍可解讀登入票證。
- `Hosting:SecurityHeadersEnabled=true`，啟用 MIME 嗅探防護、來源政策與 frame-ancestors。
- 正式環境使用 Secure Cookie、既有 Anti-forgery、登入限流與角色權限。
- SQL Server 不對外開埠，備份、密碼與環境設定不放入靜態目錄或 Git。
- 保留 Azure Free Trial spending limit，固定單台主機，不建立自動擴充。

## 啟動與恢復

- API、Web 與 Caddy 由 systemd 自動啟動及重啟，SQL 容器採 `unless-stopped`。
- `qmah-health.timer` 每分鐘檢查，連續三次失敗才重啟對應服務。資料庫異常時先處理資料庫。
- 登入票證金鑰保存在 `/var/lib/qmah/keys`，主機重啟後仍可辨識登入 Cookie。
- `bootstrap.sh` 是新主機首次安裝腳本，包含資料庫還原，不是日常重啟或更新指令。
- 準備安裝時，將本目錄的設定檔、健康檢查腳本及服務單元與建置包一起放入 `/home/qmahadmin`。

## 外部服務設定

Google 登入需允許 `https://qmah.eastus.cloudapp.azure.com/signin-google`，Logto 需允許
`https://qmah.eastus.cloudapp.azure.com/Callback`。Turnstile 需允許部署網域。
這些設定由外部服務控制台管理，程式不會略過驗證。

Turnstile Site Key 是公開設定，Secret Key 僅放在 API 的 `Turnstile__SecretKey`。
直接 Google 登入讀取 `Authentication__Google__ClientId` 與 `Authentication__Google__ClientSecret`。
經 Logto 的 Google 登入使用 Logto 控制台的 Google Connector，不會讀取 Azure 的 Google 設定。
會員驗證信與重設密碼目前由 Brevo 寄送；其他郵件服務設定存在不代表已加入這條寄信流程。

## 分支自動更新

推送 `deploy/azure-demo` 會執行 `.github/workflows/azure-demo.yml`，也可手動啟動同一流程。
前端既有測試、建置與 Linux 發佈通過後才會部署。Azure 授權使用只信任此分支的 GitHub OIDC，
不在 GitHub 保存 SSH 金鑰或 Azure 長效密碼，也不放寬 VM 的 SSH 來源限制。

更新不執行 `bootstrap.sh`、資料庫還原或 Migration，不替換環境檔、會員上傳與登入金鑰。
最近十四天的舊版雜湊 JS/CSS 保留供已開啟的分頁讀取；HTML 不快取，找不到的 JS 不回傳首頁 HTML。
API、前台或後台啟動檢查失敗時，`update.sh` 會復原前一版應用程式及 Caddy 設定。
資料庫版本更新需另行明確執行，單純推送程式碼不會覆蓋線上資料。

## 承載與無人值守

- 部署版 API 同時處理最多 48 個一般 HTTP 請求、另排隊 48 個；後台為 24 個、另排隊 24 個。超量回傳 429 與 Retry-After，既有登入及發文限流仍保留。長連線與同機健康檢查不占這個額度。
- 前端只對 GET 的暫時斷線、408、429、502、503、504 做最多兩次退避重試。下單、付款、取消、發文等寫入不自動重送，401、403 也不重試。
- API 記憶體上限 1.5 GiB、後台 1 GiB；記憶體耗盡或程序異常時由 systemd 重啟。SQL 容器保留 3 GiB 的限制，資料庫引擎另設定 2 GiB 上限。
- SQL、API、後台與 HTTPS 入口每分鐘檢查，連續三次失敗才恢復服務；資料庫故障先恢復資料庫。
- 每日 UTC 18:00（臺灣凌晨 02:00）備份 QMAH 並執行 VERIFYONLY，失敗隔五分鐘再試，一小時最多三次。只在成功後清除超過七天的每日備份。
- 部署資料夾只留最近三版，日誌最多 256 MiB、保留最多十四天，剩餘空間不足 1 GiB 時拒絕更新，保留原站。
- Azure 建置包 `deployment/updates/` 超過七天由儲存體生命週期規則清除，不影響線上資料庫。
- 這些限制只由 Azure 的服務單元啟用，本機設定、業務規則與資料庫機制維持原狀。

## 首屏與導覽

頁首與頁尾先顯示，主要內容等首批 API 回覆後顯示，首屏素材最多額外等待 650 ms，不強制延長動畫。最長等待十二秒，背景刷新不遮住正在使用的頁面。
翻書動畫改自 [React Awesome Loaders 的 BookLoader](https://awesome-loaders.netlify.app/docs/loaders/bookloader/)，原作參考 Aaron Iker。授權保留在 `QMAH.Client/public/licenses/React-Awesome-Loaders.txt`；動畫以純 CSS 使用，沒有引入 React。
404 書架動畫改自 [Valeriia 的 Missing Book](https://codepen.io/valerite-dev/pen/KMZyLz)，配合鑑定屋調整棕色與繁中文案，MIT 授權保留在 `QMAH.Client/public/licenses/Missing-Book-404.txt`。
不存在的網址使用 404 頁，提供回首頁入口；未知 JS 檔仍回真正的 404，不傳回 HTML 冒充模組。
商城列出最新已發佈的官方商城公告，每分鐘重新讀取；資料排序與公告發布條件由 API 決定。

## 共用互動與社群

社群寬版檢視使用 `qmah.social.width` localStorage，標準版 1120 px、寬版最大 1760 px；不因換頁、刷新或尺寸縮放改寫偏好。公告折疊與每列欄數沿用各自的偏好。
貼文牆每次讀取二十篇，接近底部讀取下一頁，直到全部顯示；保留手動載入更多與錯誤重試入口，切換篩選或排序會取消舊請求並回到首批。
共用確認視窗處理刪除貼文、留言與地址，取消／Escape 不寫入，切換路由會取消尚未確認的操作。成功提示由根元件顯示，登入頁也能收到提示。送出中的操作會防止重複請求。

## 本機相容性

代理標頭、PathBase、安全標頭及金鑰保存路徑都由部署設定啟用。本機未提供設定時維持原本入口。
一般鑰匙沿用 `normal.png`。會員背包的簡潔版樣式限定在非書本模式，圖鑑書本保留合成魔法陣。

## 2026-10-12 鑰匙顯示回歸修復

- `28708ef9`，2026-10-08 14:48:57 +0800，提交帳號 `HsuanC0921`：
  在 `key-list.scss` 全域隱藏魔法陣，意外影響圖鑑書本模式。
- `4d9546ec`，2026-10-08 16:08:02 +0800，同一提交帳號：
  將共用一般鑰匙素材由 `normal.png` 改成 `key-normal.svg`。
- 修復：恢復插畫素材，將隱藏魔法陣的簡潔卡片規則限定在非書本背包。
  合成規則、扣除數量、交易與獎勵機制不變。
- Git 的作者帳號只代表提交身分，不能單憑這個紀錄判定當時操作的是人或自動工具。

帳號授權快取與部署機密僅保存在本機使用者目錄，不提交或上傳簡報資料夾。
