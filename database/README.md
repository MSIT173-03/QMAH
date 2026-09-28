# QMAH 資料庫入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

本目錄只保留產品程式需要的 DB-first 契約與相容版本標記：

- [`Schema.sql`](Schema.sql)：可 review 的資料庫結構契約，供 SQL Server 與 EF Core Scaffold 對照。
- [`VERSION`](VERSION)：QMAH 主專案目前配合的完整 Snapshot 版本，目前為 `db-v0.10.2`。
- [`upgrades/0.7.0-to-0.8.0.sql`](upgrades/0.7.0-to-0.8.0.sql)：保留既有資料，將 `db-v0.7.0` 升級至 `db-v0.8.0`。
- [`upgrades/0.8.0-to-0.9.0.sql`](upgrades/0.8.0-to-0.9.0.sql)：移除重複的一般鑰匙並啟用西夏年代鑰匙，將 `db-v0.8.0` 升級至 `db-v0.9.0`。
- [`upgrades/0.10.0-to-0.10.1.sql`](upgrades/0.10.0-to-0.10.1.sql)：保留既有資料，貼文/留言新增 `SimHash` 重複偵測指紋、`ContentReports` 支援系統自動送出的檢舉，將 `db-v0.10.0` 升級至 `db-v0.10.1`。
- [`upgrades/0.10.1-to-0.10.2.sql`](upgrades/0.10.1-to-0.10.2.sql)：新增 `ContentModerationSettings`（SimHash 比對天數／相似度門檻可由後台調整）；貼文/留言/圖片新增 `AiReviewedAt` 供 AI 內容審查背景排程追蹤進度，將 `db-v0.10.1` 升級至 `db-v0.10.2`。
- [`upgrades/0.10.2-store-order-shipping.sql`](upgrades/0.10.2-store-order-shipping.sql)：使用 `db-v0.10.2` 完整 Snapshot 時，商城結帳前必須套用此升級，加入訂單配送方式與運費欄位；舊訂單標為 `LEGACY`（配送方式未記錄）、運費設為 0，保留原金額與會員資產。`VERSION` 仍標示基底完整 Snapshot，而非宣稱遠端已有新版 Snapshot。
- [`seeds/store-sale-prices.sql`](seeds/store-sale-prices.sql)：依穩定 `ExternalRef` 順序，對最多三件既有匯入商品寫入可追溯的示範折扣率；可重複執行。
- [`seeds/store-showcase-orders-shipping.sql`](seeds/store-showcase-orders-shipping.sql)：**僅限純展示資料庫、手動選用**。套用上述訂單欄位升級後，依目前商城規則重整所有展示訂單的配送、運費與付款快照；若有非展示訂單即停止，不能用於正式資料庫。

完整結構、共同資料、Identity、後台展示資料與版本歷史集中在 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database)。目前以 `db-v0.10.2` Release 的已驗證 `.bak` 還原 `QMAH`，再套用上述商城訂單升級；同版本 `QMAH.sql` 在本機重建時於外鍵建立步驟失敗，修正前不建議用它取代 `.bak`。

產生下一版 Snapshot 時，依 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html) 的單一輸出流程操作，並同步更新 `Schema.sql`、`VERSION`、QMAH-Database 的 `manifest.json` 與 Git tag。
