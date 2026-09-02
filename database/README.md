# QMAH 資料庫入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

本目錄只保留產品程式需要的 DB-first 契約與相容版本標記：

- [`Schema.sql`](Schema.sql)：可 review 的資料庫結構契約，供 SQL Server 與 EF Core Scaffold 對照。
- [`VERSION`](VERSION)：QMAH 主專案目前配合的完整 Snapshot 版本。

完整結構、共同資料、Identity、後台展示資料與版本歷史集中在 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database)。直接取得該 Repository 的 `QMAH.sql`，在本機乾淨還原成 `QMAH` 資料庫即可；不需要在這裡尋找增量 Patch 或 Seed。

產生下一版 Snapshot 時，依 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html) 的單一輸出流程操作，並同步更新 `Schema.sql`、`VERSION`、QMAH-Database 的 `manifest.json` 與 Git tag。
