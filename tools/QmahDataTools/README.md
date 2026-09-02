# QMAH 資料處理工具入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

資料工具的完整責任、命令、展示資料邊界與 Snapshot Release 流程，集中在 [QMAH-Docs 的資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html)。本檔只保留程式 Repository 內的路標，避免重複維護操作手冊。

常用工具位於本目錄：

- `NpmArtifactPipeline`：收集與檢查故宮文物資料。
- `NpmDataImporter`：文物資料包預檢與安全匯入。
- `ArtifactProductGenerator`：由授權文物產生對應商品。
- `QmahDatabaseRelease`：展示資料、Snapshot 匯出與資料庫驗證。
- `Export-ReferenceDatabase.ps1`：單一 Snapshot pipeline。

可重跑流程與參數說明見 [QmahDatabaseRelease 工具說明](QmahDatabaseRelease/README.md)。完整 `QMAH.sql` 由 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 提供；網站啟動不建立資料庫，工具輸出、credentials、快取與資料庫檔案也不提交到 Git。
