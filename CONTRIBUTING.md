# QMAH 協作入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database)

QMAH 的分支、Commit、Pull Request、Schema 變更、Snapshot 交付與衝突處理規則，參考本檔與 README。

修改產品程式前，先閱讀 [README](README.md) 與 [docs](docs/README.md)。

Azure 一個月免費展示已結束。日常修改、PR 與安全修補不得依賴舊站可用，也不應重新啟動歷史部署流程。請以本地環境與 CI 驗證；專題不再保證線上展示可用。

基本要求：

- 不執行 force push、不改寫共同歷史，也不把本機密碼提交到 Repository。
- DB-first 結構變更要同步核對 `database/Schema.sql`、Entity、`QmahDbContext`、API 與文件。
- 完整資料庫 Snapshot 由 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database) 管理，不在本 Repository 另放一份大型 SQL。

## 分支與合併

`main` 是唯一長期分支。從最新 `main` 建立 `fix/<主題>`、`chore/<主題>` 或 `feature/<主題>`，提交 PR，通過相關檢查後 squash merge；合併後刪除短期分支。已結訓專題不再維護平行的功能分支、`develop` 或部署分支。

刪除歷史分支前，先確認提交已合併，或其檔案內容與已合併版本一致。仍由 worktree 使用、含未合併成果或用途不明的本機分支保留，不強制清除。

## Release 與 tag

| 項目 | 格式 | 範例 |
| --- | --- | --- |
| 主專案 tag | `vMAJOR.MINOR.PATCH` | `v1.1.1` |
| 主專案 Release 標題 | `<tag> — <本次用途>` | `v1.1.1 — 展示封存與維護修補` |
| 資料庫 tag（另一個 repo） | `db-vMAJOR.MINOR.PATCH` | `db-v1.0.10` |

修補錯誤、相依套件與維護調整增加 patch；新功能增加 minor；不相容變更增加 major。兩個 repo 各自版本，不為了看起來一致而同步增加資料庫版號。

發行時從 CI 通過的 `main` 提交建立 tag，Release 說明對應 `CHANGELOG.md`，標明相容資料庫版本、驗證結果與限制。既有 tag 與資產下載網址不移動、不重命名；只整理 Release 顯示標題。修正後另發新版，不用刪 tag 重發覆蓋舊版本。
