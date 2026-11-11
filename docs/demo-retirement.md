# Azure 展示已結束

QMAH 是 2026 年 10 月發表的結訓專題。Azure 一個月免費試用期已結束，付費資源因此停止，原展示網址不再提供服務；原始碼、截圖、資料庫發行版與本地執行方式仍保留。

## 現在如何使用

- 看功能與畫面：根目錄 [README](../README.md)。
- 自己執行：使用 README 的 Docker Compose 或 Visual Studio／.NET 與 Angular 開發流程，不需要 Azure 訂用帳戶。
- 還原展示資料：下載 [QMAH-Database `db-v1.0.10`](https://github.com/MSIT173-03/QMAH-Database/releases/tag/db-v1.0.10)，先比對 SHA-256，再還原到自己的本機 SQL Server。不要拿公開快照取代有使用者資料的資料庫。
- 使用 Google／Logto、寄信、Turnstile 或 AI 審查：自行申請並設定服務。歷史展示金鑰、回呼網址與寄信設定不保證有效。

## 已停止的自動化

Azure 程式部署、資料庫更新與線上診斷三個工作流程已全域停用。舊部署分支、安裝／更新／備份／自我修復腳本與其專用測試已從目前版本移除；完整內容可在 [清理前的歷史提交](https://github.com/MSIT173-03/QMAH/tree/1252a074/deploy/azure-demo) 查閱。

Git 歷史與既有發行 tag 不改寫。未合併或仍由本機 worktree 使用的成果保留；一般維護只使用 `main` 與短期 PR 分支。

一般建置、前端測試、本地 Docker 腳本測試與相依套件資安檢查仍保留。這些檢查不登入 Azure、不啟動 VM，也不部署網站。

## 2026-11-11 查核

- 訂用帳戶方案仍為 `FreeTrial`，`spendingLimit` 為 `On`。
- 訂用帳戶狀態為 `Warned`；展示 VM 為 `PowerState/stopped`，狀態原因為 `VMStoppedToWarnSubscription`。
- 這表示停止與訂用帳戶狀態有關，不能當成一般應用程式當機而重跑安裝或自我修復。
- 未確認確切到期日與帳務餘額，也未確認獨立計費的支援方案或 Marketplace 訂閱。以上不是帳單結清、資源全數刪除或完全零費用的證明。

## 管理員收尾清單

GitHub 工作流程停用已完成；其餘涉及帳務、資料、授權與外部服務的操作，仍須由帳號／資源管理員確認後執行。本輪沒有刪除 Azure 資源或撤銷第三方金鑰。

1. 在 Azure「Cost Management + Billing」確認到期日、未結費用、支援方案及 Marketplace 訂閱。維持免費方案支出上限，不升級為 Pay-As-You-Go。
2. 備份需要保留的最新資料庫、使用者上傳與必要設定，確認備份可以取得。GitHub 的公開展示快照不包含最後一刻的全部線上資料。
3. 若不再保留展示環境，刪除 `qmah-demo-rg` 及確認相關磁碟、公用 IP、儲存體與 Content Safety 資源已移除。VM 只顯示「Stopped」不能單獨證明已停止所有費用；不要為了查核而重新啟動 VM。
4. GitHub Actions 的 `Deploy Azure demo`、`Apply Azure demo database updates`、`Azure demo read-only diagnostics` 已確認為 `disabled_manually`。日後不得從舊提交重新啟用部署。
5. 撤銷只給舊部署使用的 Azure federated credential／角色指派，移除 GitHub 的 `QMAH_AZURE_CLIENT_ID`、`QMAH_AZURE_TENANT_ID`、`QMAH_AZURE_SUBSCRIPTION_ID` 變數；共用的身分或授權須先確認其他專案沒有使用。
6. 從 Google OAuth、Logto、Turnstile 等控制台移除舊 Azure 主機名稱與回呼 URI，撤銷專供此站使用的寄信與 AI 服務金鑰。不要移除其他網站仍使用的設定。

## 重新公開部署前

請另建自己的環境、網域與憑證，重新檢查支出、權限、套件、作業系統／容器弱點與登入流程。Docker Compose 預設是本機 Development 展示設定，不能原封不動對外公開。

尤其要處理 [第三方登入首次同 Email 綁定的信任限制](external-login-checks.md)，配置正式 Turnstile、HTTPS、備份、金鑰保護與最小權限。Git 歷史中的 Azure 腳本不代表目前的 Azure 版本或資安基準已經驗證。

參考：[Azure 免費帳戶避免費用](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account)、[Azure 支出上限與例外費用](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit)、[虛擬機電源狀態與計費](https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing)。
