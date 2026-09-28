# QMAH 資料庫入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

本目錄只保留產品程式需要的 DB-first 契約與相容版本標記：

- [`Schema.sql`](Schema.sql)：可 review 的資料庫結構契約，供 SQL Server 與 EF Core Scaffold 對照。
- [`VERSION`](VERSION)：QMAH 主專案目前配合的完整 Snapshot 版本，目前為 `db-v0.11.0`。
- [`upgrades/0.7.0-to-0.8.0.sql`](upgrades/0.7.0-to-0.8.0.sql)：保留既有資料，將 `db-v0.7.0` 升級至 `db-v0.8.0`。
- [`upgrades/0.8.0-to-0.9.0.sql`](upgrades/0.8.0-to-0.9.0.sql)：移除重複的一般鑰匙並啟用西夏年代鑰匙，將 `db-v0.8.0` 升級至 `db-v0.9.0`。
- [`upgrades/0.10.0-to-0.10.1.sql`](upgrades/0.10.0-to-0.10.1.sql)：保留既有資料，貼文/留言新增 `SimHash` 重複偵測指紋、`ContentReports` 支援系統自動送出的檢舉，將 `db-v0.10.0` 升級至 `db-v0.10.1`。
- [`upgrades/0.10.1-to-0.10.2.sql`](upgrades/0.10.1-to-0.10.2.sql)：新增 `ContentModerationSettings`（SimHash 比對天數／相似度門檻可由後台調整）；貼文/留言/圖片新增 `AiReviewedAt` 供 AI 內容審查背景排程追蹤進度，將 `db-v0.10.1` 升級至 `db-v0.10.2`。
- [`upgrades/0.10.2-store-order-shipping.sql`](upgrades/0.10.2-store-order-shipping.sql)：僅供沿用 `db-v0.10.2` 舊 Snapshot 的環境升級訂單欄位；全新 `db-v0.11.0` 已包含，不需再執行。
- [`seeds/store-sale-prices.sql`](seeds/store-sale-prices.sql)：依穩定 `ExternalRef` 順序，對最多三件既有匯入商品寫入可追溯的示範折扣率；可重複執行。
- [`seeds/store-showcase-orders-shipping.sql`](seeds/store-showcase-orders-shipping.sql)：**僅限純展示資料庫、手動選用**。沿用 `db-v0.10.2` 並套用上述欄位升級後，依目前商城規則重整展示訂單；新版 `db-v0.11.0` 已包含此結果，不需再執行。

完整結構、共同資料、Identity、後台展示資料與版本歷史集中在 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database)。新環境使用 `db-v0.11.0` Release 的已驗證 `.bak` 或同源 `QMAH.sql` 建立 `QMAH`；舊 `db-v0.10.2` 的 SQL 重建問題不影響此新版。

產生下一版 Snapshot 時，依 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html) 的單一輸出流程操作，並同步更新 `Schema.sql`、`VERSION`、QMAH-Database 的 `manifest.json` 與 Git tag。
