# QMAH 資料處理工具入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

資料工具的責任、命令、展示資料邊界與 Snapshot Release 流程，見 [QMAH-Docs 的資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html)。

本檔只列出主 Repository 內的共用工具入口，不在這裡重複維護操作手冊。資料庫測試資料、展示流水、商品產生器與 Snapshot exporter 集中在 [QMAH-Database/tools/QmahDataTools](https://github.com/MSIT173-03/QMAH-Database/tree/main/tools/QmahDataTools)。

常用工具位於本目錄：

- `NpmArtifactPipeline`：收集與檢查故宮文物資料。
- `NpmDataImporter`：文物資料包預檢與安全匯入。
- `NpmDataWorkbench`：以 WPF 介面串接文物與商城來源工具。
- `NpmShopSampleCollector`：商城來源研究與受限樣本收集。

資料庫測試資料工作台、`ArtifactProductGenerator`、`QmahDatabaseRelease`、`.bak`／`.sql` Snapshot 產出與資料驗證，使用 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 的工具。完整 `QMAH.sql` 也由該 Repository 提供。

網站啟動不建立資料庫，工具輸出、credentials、快取與資料庫檔案也不提交到 Git。
