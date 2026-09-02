<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="QMAH.Web/wwwroot/images/brand/qmah-logo.svg">
    <img src="QMAH.Web/wwwroot/images/brand/qmah-logo-dark.svg" width="420" alt="清明鑑定屋 QMAH — Qing Ming Appraisal House">
  </picture>
</p>

# QMAH｜清明鑑定屋

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [開發文件](https://msit173-03.github.io/QMAH-Docs/) ｜ [開發資料庫](https://github.com/MSIT173-03/QMAH-Database)

QMAH 是以 ASP.NET Core、Angular、REST API 與 SQL Server DB-first 為核心的清明上河圖文物鑑定與交流專題。後端管理後台與使用者前台共用資料契約、Identity、媒體與資料庫規則。

## 先開始

1. 依 [開發文件](https://msit173-03.github.io/QMAH-Docs/) 的「開始開發」準備 .NET、Node.js、SQL Server 與本機設定。
2. 從 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 取得目前相容的 `QMAH.sql`，在本機建立 `QMAH` 資料庫。
3. 啟動 `QMAH.Api`、`QMAH.Web` 或 `QMAH.Client`，再依功能文件開始工作。

一般開發者只需取得完整 Snapshot；不必自行建立 Schema、執行 Migration 或補跑 Seed。需要完整步驟時，請從 [QMAH 開發文件](https://msit173-03.github.io/QMAH-Docs/) 的任務導覽開始。

## Repository 分工

| Repository | 責任 |
| --- | --- |
| [QMAH](https://github.com/MSIT173-03/QMAH) | 產品程式、`Schema.sql`、開發工具與最小入口文件 |
| [QMAH-Docs](https://github.com/MSIT173-03/QMAH-Docs) | 繁體中文開發文件與 VitePress 文件站 |
| [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) | 可直接還原的完整 SQL Server Snapshot、manifest 與版本歷史 |

## 開發共識

- SQL Server Schema 是 DB-first 契約；結構變更要同步核對 `database/Schema.sql`、Entity、`QmahDbContext`、API 與文件。
- Angular 使用 REST API，不直接依賴 Entity 或資料表名稱；Razor 管理後台遵守既有 Area 邊界與共用 Tabler 介面。
- 網站啟動不建立資料庫、不套用 Migration，也不自動塞入測試資料。
- 圖片使用邏輯媒體路徑與授權資料；本機、物件儲存與 CDN 的切換由後端設定處理。
- Commit、分支、Schema 變更與 Snapshot 交付依 [Git 與 GitHub 協作手冊](https://msit173-03.github.io/QMAH-Docs/reference/git-workflow.html) 執行。

## Repository 內入口

- [資料庫責任與 Snapshot 路標](database/README.md)
- [文件入口](docs/README.md)
- [貢獻與協作規則](CONTRIBUTING.md)
- [資料工具入口](tools/QmahDataTools/README.md)

授權與課程使用範圍依專案既有約定辦理。
