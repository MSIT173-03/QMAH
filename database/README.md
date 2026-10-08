# QMAH 資料庫入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

本目錄只保留產品程式需要的 DB-first 契約與相容版本標記：

- [`Schema.sql`](Schema.sql)：可 review 的資料庫結構契約，供 SQL Server 與 EF Core Scaffold 對照。
- [`VERSION`](VERSION)：QMAH 主專案目前配合的完整 Snapshot 版本，目前為 `db-v1.0.0`。
- [`upgrades/0.7.0-to-0.8.0.sql`](upgrades/0.7.0-to-0.8.0.sql)：保留既有資料，將 `db-v0.7.0` 升級至 `db-v0.8.0`。
- [`upgrades/0.8.0-to-0.9.0.sql`](upgrades/0.8.0-to-0.9.0.sql)：移除重複的一般鑰匙並啟用西夏年代鑰匙，將 `db-v0.8.0` 升級至 `db-v0.9.0`。
- [`upgrades/0.10.0-to-0.10.1.sql`](upgrades/0.10.0-to-0.10.1.sql)：保留既有資料，貼文/留言新增 `SimHash` 重複偵測指紋、`ContentReports` 支援系統自動送出的檢舉，將 `db-v0.10.0` 升級至 `db-v0.10.1`。
- [`upgrades/0.10.1-to-0.10.2.sql`](upgrades/0.10.1-to-0.10.2.sql)：新增 `ContentModerationSettings`（SimHash 比對天數／相似度門檻可由後台調整）；貼文/留言/圖片新增 `AiReviewedAt` 供 AI 內容審查背景排程追蹤進度，將 `db-v0.10.1` 升級至 `db-v0.10.2`。
- [`upgrades/0.10.2-store-order-shipping.sql`](upgrades/0.10.2-store-order-shipping.sql)：僅供沿用 `db-v0.10.2` 舊 Snapshot 的環境升級訂單欄位；全新 `db-v0.11.0` 已包含，不需再執行。
- [`upgrades/0.12.0-store-ecpay-payments.sql`](upgrades/0.12.0-store-ecpay-payments.sql)：保留既有資料，在 `db-v0.12.0` 上新增綠界付款嘗試 `PaymentAttempts`、付款狀態 `REFUND_REQUIRED` 與逾時取消用的訂單索引；可重複執行。
- [`seeds/store-sale-prices.sql`](seeds/store-sale-prices.sql)：依穩定 `ExternalRef` 順序，對最多三件既有匯入商品寫入可追溯的示範折扣率；可重複執行。
- [`seeds/store-showcase-orders-shipping.sql`](seeds/store-showcase-orders-shipping.sql)：**僅限純展示資料庫、手動選用**。沿用 `db-v0.10.2` 並套用上述欄位升級後，依目前商城規則重整展示訂單；新版 `db-v0.11.0` 已包含此結果，不需再執行。

完整結構、共同資料、Identity、後台展示資料與版本歷史集中在 [QMAH-Database](https://github.com/MSIT173-03/QMAH-Database)。新環境使用 `db-v1.0.0` Release 的已驗證 `.bak` 或同源 `QMAH.sql` 建立 `QMAH`；舊 `db-v0.10.2` 的 SQL 重建問題不影響此新版。

產生下一版 Snapshot 時，依 [資料工具參考](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html) 的單一輸出流程操作，並同步更新 `Schema.sql`、`VERSION`、QMAH-Database 的 `manifest.json` 與 Git tag。

## db-v1.0.0 更新內容

本版對應 QMAH v1.0.0，接續 db-v0.12.1。主要差異是社群媒體改用新版儲存路徑，完整快照包含目前的貼文與媒體參照。

- `social.SocialPosts` 新增 `MediaLayout`（預設 `AUTO`，可選 `SINGLE`、`DOUBLE`、`TRIPLE`）；兩個 Repository 的 Schema 與 EF model 已同步，共 58 張表。
- 社群媒體使用相對於儲存根目錄的路徑；主程式兼容舊 `/media/` 參照，無效或越界路徑回傳 404。資料庫備份不含實體圖片，還原時需一併保留對應的媒體檔案與儲存根目錄設定。
- 使用 `QMAH-1.0.0.bak` 或在乾淨資料庫執行 `QMAH-1.0.0.sql.zip` 內的 SQL；不要將完整 SQL 疊加到舊資料庫。正式快照不提供 0.12.1→1.0.0 增補腳本。
- BAK、決定性 SQL、乾淨重建、逐表比對、EF model 與 Web 啟動驗證均通過。

## db-v0.12.1 更新內容

本版對應 QMAH v0.12.1，結構契約 `Schema.sql` 與完整 Snapshot 一併納入綠界付款資料：

- 新增 `store.PaymentAttempts`（綠界付款嘗試，每次前往付款都有獨立的 `MerchantTradeNo`，保留回呼時間、綠界交易編號與回應訊息），`Payments.Status` 增加 `REFUND_REQUIRED`（訂單取消後才收到付款，需人工退款），並新增 `IX_StoreOrders_Status_CreatedAt` 供逾時未付款訂單自動取消查詢。共 58 張表。
- 本版是完整快照：`db-v0.12.0` 環境若要保留資料，可執行 `upgrades/0.12.0-store-ecpay-payments.sql`；要與正式展示資料一致則全新還原 `db-v0.12.1` 的 `.bak` 或同源 SQL。
- 附件的 SQL 以 zip 壓縮上傳（`QMAH-0.12.1.sql.zip`），解壓後內容與 Repository 根目錄的 `QMAH.sql` 逐位元組相同。

## db-v0.12.0 更新內容

本輪結構契約與種子內容均納入同一版本，不另開內容版本。本版對應 QMAH v0.12.0，需搭配 decimal 進度與獎勵服務，不可只替換資料庫就沿用舊 int 讀取程式。

- 單人與多人共用每日 100 點，符合條件可一天突破一次至 130 點。完成一場多人或三種不同單人玩法達 B 級以上即可取得突破資格，突破不直接加點數。使用既有 DailyMemberActivities 記錄，沒有新增通用獎勵紀錄表。
- 多人領獎收據擴充在 GamePlayers，包含領取時間、點數、實得鑰匙、進度及倍率。零點數但仍有鑰匙的場次也能正確防重領。MiniGameAttempts 補上倍率及實得一般鑰匙，重送使用原收據。
- 鑰匙進度與流水改為 decimal(12,2)，圖鑑完成度達 80% 後取得一半、全部收齊後取得四分之一，仍可累積。完成度以啟用中的文物計算，新增館藏後重新判斷。
- 新增 ArtifactAppreciationVotes，以回答與會員作為複合主鍵。鑑賞票獨立於回合計分票，每個已完成房間提供三類回答各一位第一名，支援依票數、時間、回答類型和文物分類篩選。
- 結帳直接使用點數的上限為折價券套用後商品小計的 5%，且最多 20 點，不折抵運費。原點數兌換券門檻與券值保持不變。
- db-v0.12.0 必須全新還原，不提供 0.11→0.12 增補腳本。本次同時重整場次、回答、收藏、成就與商務資料，只補欄位無法得到相同結果。先備份舊資料庫，停止 API／Web，再還原新版完整 BAK，或在乾淨資料庫執行同源 SQL。不要將完整 SQL 疊加到舊資料庫，也不要先執行舊產生器再重跑種子。

Snapshot、校驗碼、完整驗證結果與詳細發布說明由同一次既有匯出流程產生。完整附件見 [db-v1.0.0 Release](https://github.com/MSIT173-03/QMAH-Database/releases/tag/db-v1.0.0)。