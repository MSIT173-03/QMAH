# 相依套件與維護紀錄

本頁記錄 2026-11-11 的檢查與修補。當時的「未發現已知弱點」不代表沒有尚未公開的漏洞，也不代表本專題已符合正式營運的安全需求。

## 2026-11-11 更新

遠端 `main` 已包含 2026-10-21 合併的 PR #39，這次以該版本為基礎，沒有重新套用同一批修補。

| 項目 | 原版本／狀態 | 本次處理 |
| --- | --- | --- |
| Angular framework 與 compiler-cli | 21.2.25 | 21.2.26，同主版本更新 |
| Angular CLI／build | 21.2.25 | 21.2.29，修補間接的 body-parser、undici、Zod 等弱點 |
| Vitest／mocker | 4.1.11 | 4.1.12，修補 mock 註冊與 Windows 路徑問題 |
| glob／minimatch | CLI 間接依賴仍受影響 | overrides 固定在 14.0.4／11.0.8；實際替換套件，不略過通報 |
| NuGet | 原有 12 個專案直接及間接依賴 | 官方稽核未發現已知弱點；新增隔離 API 測試工具後同樣納入稽核，保留既有已修補套件，不加入通報例外 |

Angular framework 與 CLI 的修補版號不同，不能假設兩者最新 patch 一致。沒有使用 `--force`、`--legacy-peer-deps` 或 `npm audit fix --force`。

本次 `npm audit --package-lock-only` 包含正式及開發依賴，從 **22 個受影響套件項目（4 high、18 moderate）降至 0**。這是 npm 對依賴鏈的計數，並不是 22 個互不相干的漏洞；一個間接依賴的弱點可能讓多個上層套件被標記。

主要通報來源：

- [Vitest mock 註冊程式碼注入](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)、[Windows mock 路徑繞過](https://github.com/advisories/GHSA-xp26-3454-mjgp)。
- [body-parser 壓縮內容阻斷服務](https://github.com/advisories/GHSA-27r3-jxmh-p828)。
- [undici TLS 選項遺失](https://github.com/advisories/GHSA-2m5v-pch6-74hx)與其他當日通報。
- [Zod 記憶體耗盡](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)。
- [glob 取消後繼續遍歷](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)、[minimatch globparts 放大](https://github.com/advisories/GHSA-g3hv-75wg-m249)。

多數 npm 弱點位於建置／測試工具，並非 Azure 上的 ASP.NET 執行程序；仍需修補，開發伺服器也不應直接暴露到公網。

## 如何重做檢查

在根目錄執行：

```powershell
pwsh -File tools/Check-DependencySecurity.ps1
cd QMAH.Client
npm audit --package-lock-only
```

NuGet 腳本以鎖定模式還原全部 `.csproj`，包含 API、後台、共用基礎設施與資料／驗證工具，再查詢直接及間接依賴。`.sln` 同時含 JavaScript `.esproj`，直接對整個 solution 執行 NuGet package list 會產生不支援專案格式的錯誤；因此逐一稽核 `.csproj`，前台另由 npm 完整檢查。

Dependency security 工作流程每週一 UTC 01:00（臺灣 09:00）、相依檔案 PR／main push 及手動啟動時執行。沒有嚴重度略過參數、失敗忽略或弱點 allowlist。查詢失敗不能當成「0 個弱點」。

## 本地驗證

- npm 啟動／依賴安裝檢查：11 個通過。
- 前端完整回歸：17 份重複初始化測試合併為一份，原斷言全部保留；authGuard 改成真正的登入情境。合併後 72 個檔案、427 個案例通過，數量變動不是品質目標，設計見 [測試分工](testing.md)。
- Angular production build 通過；社群元件樣式仍超過 36 kB 的警告預算，但低於原本 44 kB 的錯誤上限。沒有調高或停用預算。
- .NET 解決方案 Release 建置通過，0 warnings、0 errors。
- NuGet 安全檢查涵蓋全部 13 個 `.csproj`，包含新的 `ApiVerification`，直接及間接依賴均未發現已知弱點。
- Docker 備份下載的 4 個隔離測試通過：快取有效不下載、損壞快取重取、錯誤雜湊阻止替換、下載失敗清理暫存檔。測試使用假資料與網路替身，沒有讀取真實資料庫內容。
- SQL bootstrap 的隔離測試驗證密碼含空白仍可使用且不放入命令列、未就緒不嘗試還原、還原失敗回傳原本錯誤。測試使用假 SQL 程序，沒有代替真正 SQL Server 的啟動驗證。
- Docker Compose 設定與現行工作流程 YAML 可解析。
- 基本 API 資安與過載恢復改由真正的 API 程序驗證，覆蓋私人 API、角色、偽造票證、CSRF、CORS、同 IP 不同會員限流與資料庫查核前的總量門禁。

本機 Node 26 的原生 `localStorage` 會遮蔽 jsdom 的瀏覽器實作，見 [Vitest #10867](https://github.com/vitest-dev/vitest/issues/10867)。`vitest.config.mts` 僅在 Node 25+ 的測試 worker 關閉 Node 原生 Web Storage，讓 jsdom 提供真正的瀏覽器 Storage；既有儲存行為測試保留。這不是停用瀏覽器的 localStorage，也沒有修改產品程式的儲存行為。CI 與 Docker 仍使用 Node 24。

## 尚未驗證及對外部署限制

- 本機 Docker Engine 未啟動，因此未執行完整容器啟動、SQL 還原、容器映像／OS 套件掃描；Compose 解析成功不等同整站啟動成功。
- Azure 展示已停止，沒有重新啟動 VM、部署新程式或驗證舊站登入／付款／寄信。外部 OAuth、郵件、Turnstile 與 AI 服務的有效性需各自管理員確認。
- 舊 Azure 部署腳本與其專用測試已隨展示退役移出目前版本；一般 Build 的 Linux job 繼續驗證現用 Docker 腳本。
- API 隔離測試會顯示 SQLite 不支援 SQL Server schema 的警告；沒有關閉這些警告，也不把這些結果當成 SQL Server schema 已驗證。
- 既有第三方登入首次同 Email 綁定仍需評估信箱可信性與原帳號重新驗證，詳見 [登入檢查文件](external-login-checks.md)。套件稽核不會檢查這類業務邏輯。
- nginx、.NET 與 SQL Server 的映像標籤不等於掃描結果。自行部署前應重新拉取、掃描並決定固定 digest，不能把本頁當成映像已無漏洞的證明。
