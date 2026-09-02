# QMAH 協作入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [開發文件](https://msit173-03.github.io/QMAH-Docs/) ｜ [開發資料庫](https://github.com/MSIT173-03/QMAH-Database)

QMAH 的分支、Commit、Pull Request、Schema 變更、Snapshot 交付與衝突處理規則，集中在 [Git 與 GitHub 協作手冊](https://msit173-03.github.io/QMAH-Docs/reference/git-workflow.html)。產品程式修改前，請先閱讀 [文件首頁](https://msit173-03.github.io/QMAH-Docs/) 對應的任務文件。

基本要求：

- 不要 force push、改寫共同歷史或把本機密碼提交到 Repository。
- DB-first 結構變更要同步核對 `database/Schema.sql`、Entity、`QmahDbContext`、API 與文件。
- 完整資料庫 Snapshot 由 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 管理，不在本 Repository 另放一份大型 SQL。
