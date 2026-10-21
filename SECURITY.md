# 資安政策

## 回報弱點

請不要在公開 Issue 回報資安問題。請到本倉庫的 **Security → Report a vulnerability** 私下回報，並附上重現步驟與影響範圍。

這是課程結訓專題，由學員維護，無法保證回應時間，但會盡力處理。

## 支援版本

只維護 `main` 分支與最新的 Release。

## 已知且刻意保留的項目

- `QMAH.Api/appsettings.Development.json` 內的綠界（ECPay）資料是綠界官方公開的**測試環境**商店參數，只能連到 `payment-stage.ecpay.com.tw`，不涉及真實金流。
- `docker-compose.yml` 的資料庫預設密碼只供本機使用，資料庫埠沒有對外開放，前台也只綁在 `127.0.0.1`。要自行部署請用 `QMAH_SA_PASSWORD` 覆寫。
- Docker 版以 Development 環境執行，Turnstile 金鑰為空，不適合直接對外提供服務。

## 機密處理

- 金鑰、連線字串與密碼一律放環境變數、`appsettings.Local.json` 或 `dotnet user-secrets`，不提交到版控。
- 早期曾把一組 Cloudflare Turnstile 開發用 Secret Key 提交進版控，該金鑰已在 Cloudflare 輪替失效。
- 本倉庫已啟用 GitHub secret scanning 與 push protection。
