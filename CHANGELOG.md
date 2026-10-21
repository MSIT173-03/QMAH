# 版本異動記錄

格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依 [語意化版本](https://semver.org/lang/zh-TW/)。資料庫快照版本另見 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database/releases)。

## [1.1.0] - 2026-10-21

專題發表後的整理版，沒有功能變更。

### 新增
- Docker Compose 一鍵啟動（`docker compose up --build`）。
- `LICENSE`（MIT）、`SECURITY.md`、Dependabot 設定、README 畫面預覽與系統架構圖。

### 安全性
- 移除版控內的 Turnstile Secret Key，該金鑰已在 Cloudflare 輪替。
- `System.Security.Cryptography.Pkcs` 升到 10.0.13，修補高風險通報。
- Angular 升到 21.2.25，修補 `@angular/router` 的高風險通報，正式相依的 `npm audit` 為 0。
- 啟用 GitHub secret scanning 與 push protection。

### 變更
- Build 工作流程改為 push 與 PR 觸發，並固定第三方 Action 的版本。
- 修正鎖定檔含 `linux-x64` 造成 CI 鎖定模式還原失敗。
- 移除 AI 協作檔與內部筆記，整理 `.gitignore` 與文件位置。

## [1.0.10] - 2026-10-13

商城與會員中心改版、社群修正與部署穩定性。對應資料庫 `db-v1.0.10`。

- 商城、購物車、訂單與折價券頁統一主打活動樣式，會員中心新版券面與成就卡片。
- 社群「全部貼文」不再被活動洗版，公告輪播只顯示公告。
- 商品與社群讀取合併重複請求，API 讀取加上逾時保護，不會自動重送付款或發文。
- 部署失敗可回退舊版，服務異常自動重啟，AI 審查限流時保存結果並冷卻重試。

## [1.0.6] - 2026-10-13

會員驗證、圖鑑與手機體驗、資料庫版本同步。

## [1.0.0] - 2026-10-08

社群媒體、活動資訊、頁尾與政策頁改版。

## [0.12.1] - 2026-10-08

前台視覺統一、商城與社群改版、後台整理與綠界付款資料結構。

## [0.12.0] - 2026-10-02

遊戲牌桌、鑑賞與獎勵整合。

## [0.11.0] - 2026-09-28

遊戲、商城與資料庫整合。

## [0.10.0] - 2026-09-20

商城資料與前台修正。
