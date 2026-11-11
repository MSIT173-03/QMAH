# 資安政策

## 回報弱點

請不要在公開 Issue 回報資安問題。請到本倉庫的 **Security → Report a vulnerability** 私下回報，並附上重現步驟與影響範圍。

這是課程結訓專題，由學員維護，無法保證回應時間，但會盡力處理。

## 支援版本

只維護 `main` 分支與最新的 Release。

一個月的 Azure 免費展示已結束，舊站不再提供服務。本倉庫保留供學習與本地展示使用，接受力所能及的資安修補；不提供正式環境的維護時效或安全保證。封存部署流程不等於刪除雲端資源或撤銷外部授權，收尾清單見 [展示結束說明](docs/demo-retirement.md)。

## 相依套件檢查

- `npm audit --package-lock-only` 包含開發依賴，不以 `--omit=dev` 隱藏建置工具風險。
- `pwsh -File tools/Check-DependencySecurity.ps1` 檢查所有 `.csproj` 的直接與間接 NuGet 套件；前台 `.esproj` 由 npm 處理。
- Dependency security 工作流程定期與 PR 執行上述檢查，查詢失敗或發現漏洞都視為失敗。Dependabot 繼續只提出資安更新。
- 每次稽核只反映當時的通報資料；容器、作業系統與外部登入服務另需檢查。實際結果見 [資安維護紀錄](docs/security-maintenance.md)。

## 已知且刻意保留的項目

- `QMAH.Api/appsettings.Development.json` 內的綠界（ECPay）資料是綠界官方公開的**測試環境**商店參數，只能連到 `payment-stage.ecpay.com.tw`，不涉及真實金流。
- `docker-compose.yml` 的資料庫預設密碼只供本機使用，資料庫埠沒有對外開放，前台也只綁在 `127.0.0.1`。要自行部署請用 `QMAH_SA_PASSWORD` 覆寫。
- Docker 版以 Development 環境執行，Turnstile 金鑰為空，不適合直接對外提供服務。
- 第三方登入首次同 Email 綁定仍有供應者信箱可信性與原帳號重新驗證的補強空間，見 [登入檢查文件](docs/external-login-checks.md)。套件無已知漏洞不代表這項登入流程已適合正式營運。

## 機密處理

- 金鑰、連線字串與密碼一律放環境變數、`appsettings.Local.json` 或 `dotnet user-secrets`，不提交到版控。
- 早期曾把一組 Cloudflare Turnstile 開發用 Secret Key 提交進版控，該金鑰已在 Cloudflare 輪替失效。
- 本倉庫已啟用 GitHub secret scanning 與 push protection。
