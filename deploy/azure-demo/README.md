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
