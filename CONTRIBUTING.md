# QMAH 協作入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database)

QMAH 的分支、Commit、Pull Request、Schema 變更、Snapshot 交付與衝突處理規則，參考本檔與 README。

修改產品程式前，先閱讀 [README](README.md) 與 [docs](docs/README.md)。

基本要求：

- 不執行 force push、不改寫共同歷史，也不把本機密碼提交到 Repository。
- DB-first 結構變更要同步核對 `database/Schema.sql`、Entity、`QmahDbContext`、API 與文件。
- 完整資料庫 Snapshot 由 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 管理，不在本 Repository 另放一份大型 SQL。
