# NpmDataWorkbench

Windows WPF GUI，統一呼叫文物 Pipeline、商城 Collector 與安全 Importer。商城頁保留作為舊來源研究介面；目前正式商品改用獨立的 `ArtifactProductGenerator`。

本工作台用於資料估算、收集、預檢與正式匯入。

一般網站開發不需要開啟本工具或執行資料匯入命令。建立開發資料庫時，可從 Release 還原 `.bak`，或直接在 SSMS 執行 [QMAH-Database 的完整 Snapshot](https://github.com/MSIT173-03/QMAH-Database)；兩種方式擇一即可。

可直接執行的版本位於工作區根目錄 `_工具輸出/portable-tools/NpmDataWorkbench.exe`。

文物頁固定顯示 8 類：銅器、陶瓷、玉器、琺瑯器、漆器、錢幣、雕刻、繪畫。

匯入區的參考上限與目前完整資料包一致：文物每類 32 筆、商品最多 256 筆。這是預檢與批次處理上限，不是資料庫硬限制；較小資料包仍可用於隔離環境驗證。

商城頁的勾選項目來自 `shop-source-catalog.json`，顯示的是商城來源分類，收集後仍會映射到正式 `store.Products.CategoryCode`。

## 操作順序

1. 先按「偵測 API 筆數」或「偵測所選分類商品量」，確認來源仍可讀取。

2. 再用小量收集，查看 `_工具輸出` 的 `quality-report.json`、圖片與重複項目。

3. 文物增加到 8 類各至少 32 筆後，送進「預檢資料與重複項目」；正式文物匯入完成後，再由 `ArtifactProductGenerator --count all` 建立一對一商品。

4. 預檢輸出的確認碼只對應當次資料；資料內容不變且完成確認後，才按「確認後寫入專案」。

GUI 不會在網站啟動時偷偷建立 SQL Server 或資料表，也不會自動改正式分類設定。

資料庫依 SQL／ERD 建立與驗證，再由同一次匯出流程產生 QMAH-Database 的 `QMAH.sql`、Release `.sql` 與 `.bak`。

商城根頁發現的新分類則另存 `source-categories.auto.json` 供映射審核。
