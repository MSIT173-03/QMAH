<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="QMAH.Media/images/brand/qmah-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="QMAH.Media/images/brand/qmah-logo.svg">
    <img src="QMAH.Media/images/brand/qmah-logo-dark.svg" width="560" alt="QMAH 清明鑑定屋">
  </picture>
</p>

# QMAH｜清明鑑定屋

[![Build](https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/MSIT173-03/QMAH/actions/workflows/build.yml)
![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4)
![Angular 21](https://img.shields.io/badge/Angular-21.2-DD0031)
![SQL Server](https://img.shields.io/badge/SQL%20Server-DB--first-315E55)

資展國際 MSIT173 期的結訓專題，5 人團隊，2026 年 10 月發表。以國立故宮博物院的開放文物資料為基礎，有圖鑑、鑑定遊戲、社群與商城。

線上展示：<https://qmah.eastus.cloudapp.azure.com/>（Azure 暫時部署，之後可能關閉）

| 首頁 | 登入 |
| --- | --- |
| ![首頁](docs/images/home.jpg) | ![登入](docs/images/login.jpg) |
| **圖鑑** | **鑑定遊戲** |
| ![圖鑑](docs/images/catalog.jpg) | ![鑑定遊戲](docs/images/game.jpg) |
| **社群廣場** | **購物商城** |
| ![社群廣場](docs/images/social.jpg) | ![購物商城](docs/images/store.jpg) |

## 功能

| 模組 | 內容 |
| --- | --- |
| Catalog 圖鑑 | 512 件文物、8 個分類、年代與來源授權標示 |
| Game 遊戲 | 四種單人小遊戲、多人鑑定房間、評分與每日獎勵 |
| Social 社群 | 貼文、留言、檢舉、活動、公告與通知 |
| User 會員 | 註冊登入、個人資料、成就 |
| Store 商城 | 文物明信片示意商品、購物車、折價券、點數與訂單 |

商城為課程示意資料，沒有實際交易。

## 系統架構

```mermaid
flowchart LR
    B[瀏覽器] --> G[反向代理<br/>Caddy / nginx]
    G -->|靜態檔| C[Angular 前台]
    G -->|/api /hubs /media| A[QMAH.Api<br/>REST API + SignalR]
    G -->|/admin| W[QMAH.Web<br/>Razor 管理後台]
    A --> D[(SQL Server)]
    W --> D
    A -.共用 Identity 與資料保護金鑰.- W
```

前台、API、後台是三個獨立的應用程式，共用同一個資料庫與登入 Cookie。API 與後台透過 `QMAH.Infrastructure` 共用 Entity 與 DbContext。

## 技術棧

ASP.NET Core 10、Entity Framework Core（DB-first）、Identity、SignalR、Angular 21.2、TypeScript、SQL Server、Cloudflare Turnstile、GitHub Actions。

## 快速啟動

### 方法一：Docker（最快）

只需要 [Docker Desktop](https://www.docker.com/products/docker-desktop/)：

```bash
docker compose up --build
```

第一次會編譯程式並下載約 40MB 的資料庫備份，完成後開 <http://localhost:8080>，管理後台在 <http://localhost:8080/admin/>。資料庫密碼可用環境變數 `QMAH_SA_PASSWORD` 覆寫，預設值只適用本機。`docker compose down -v` 會一併清除資料庫與上傳檔。

### 方法二：本機開發

需要 .NET SDK 10.0.301 以上、Node.js（版本見 `QMAH.Client/package.json`）與 SQL Server。

1. 到 [QMAH-Database 的 db-v1.0.10](https://github.com/MSIT173-03/QMAH-Database/releases/tag/db-v1.0.10) 下載 `QMAH-1.0.10.bak`，在 SSMS 還原成 `QMAH`。也可以改跑同版本的 `QMAH-1.0.10.sql`。
2. 啟動後端：

   ```powershell
   dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile https
   dotnet run --project .\QMAH.Web\QMAH.Web.csproj --launch-profile https
   ```

3. 啟動前台：

   ```powershell
   cd QMAH.Client
   npm start
   ```

前台在 `http://localhost:4200/`，API 在 `https://localhost:7249`，管理後台在 `https://localhost:7039`。Visual Studio 開啟 `QMAH.sln` 後，也可選「QMAH 全站」一次啟動。

資料庫預設自動尋找本機的 `QMAH`，要固定連線時，參考 `appsettings.Local.example.json` 建立不進版控的 `appsettings.Local.json`。展示帳號範本是 `QMAH.DemoCredentials.csv`，複製成 `.local.csv` 填密碼即可。

### Turnstile

註冊使用 Cloudflare Turnstile。早期開發曾把一組開發用 Secret Key 提交進版控，現已移除，該金鑰已在 Cloudflare 輪替失效。正式環境用環境變數 `Turnstile__SecretKey`，本機可用 [Cloudflare 官方測試金鑰](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)或 `dotnet user-secrets`。

## 測試

```powershell
cd QMAH.Client
npm test -- --watch=false      # 前端單元測試，88 個檔案、423 個案例
dotnet build QMAH.sln          # 後端建置
```

`tools/` 內另有 API、帳號驗證與付款相關的檢查程式。GitHub Actions 的 Build 工作流程會在每次 push 與 PR 執行建置與前端測試。

## 資料夾結構

```text
QMAH.Api/              REST API
QMAH.Web/              Razor 管理後台
QMAH.Client/           Angular 前台
QMAH.Infrastructure/   Entity、DbContext 與匯入核心
QMAH.Media/            共用媒體
database/              Schema.sql 與 VERSION
deploy/azure-demo/     Azure 部署腳本
deploy/docker/         Docker 建置檔
tools/                 資料處理與驗證工具
docs/                  文件
```

## 資安與版本

弱點回報方式與已知項目見 [SECURITY.md](SECURITY.md)，版本異動見 [CHANGELOG.md](CHANGELOG.md) 與 [Releases](https://github.com/MSIT173-03/QMAH/releases)。

## Git 協作

`feature/<area>` → PR → `develop` → PR → `main`，不 force push。規則見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 授權與資料來源

程式碼採 [MIT License](LICENSE)。專題僅供學習與發表，不做商業用途。

文物資料與圖像取自國立故宮博物院[典藏資料檢索－Open Data](https://digitalarchive.npm.gov.tw/opendata/)，依各資料頁標示的 CC0 或 CC BY 4.0 使用，這些素材不在 MIT 範圍內。需標示姓名的素材，資料庫保留 `AttributionText`，不可移除。第三方字型、音效與圖示的授權檔在 `QMAH.Media` 與 `QMAH.Client/public/licenses`。
