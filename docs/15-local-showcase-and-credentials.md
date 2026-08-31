# 本機展示與帳號

QMAH 的展示資料用來讓五個後台 Area、營運中心、API 與之後的前台有足夠真實的資料可以操作。目前共同 Release 快照已包含完整展示情境；本文件的資料工具只描述資料庫整合者如何在建立下一份快照前重建內容，以及個人如何在隔離資料庫調整展示資料。資料量與內容以可閱讀、可比較、可重複建立為原則，不用大量 `XXXX` 或只有一筆資料的空情境。

## 一般組員的啟動方式

一般開發只需要取得目前最新的共同 Release `.bak` 並還原成 `QMAH`；不使用 `.bak` 時，才改執行同源的完整 [`database/QMAH.sql`](../database/QMAH.sql)。完成其中一種還原後即可啟動網站，不需要執行本文件的展示資料命令，也不需要自行建立 Schema 或執行 Migration。

## 資料工具（維護者重建快照時使用）

一般組員不需要在還原最新 `.bak` 或 `database/QMAH.sql` 後執行以下命令。只有資料庫整合者要在隔離資料庫重建下一份完整 snapshot，或個人明確要調整自己的展示資料時，才依序執行：

```powershell
Copy-Item .\QMAH.DemoCredentials.csv .\QMAH.DemoCredentials.local.csv

dotnet run --project .\tools\QmahDataTools\QmahDatabaseRelease\QmahDatabaseRelease.csproj -- `
  seed-showcase-users `
  --connection "Server=(localdb)\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False"
```

接著用同一支資料工具產生社群與商城展示資料：

```powershell
dotnet run --project .\tools\QmahDataTools\QmahDatabaseRelease\QmahDatabaseRelease.csproj -- `
  generate-showcase-data `
  --connection "Server=(localdb)\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False" `
  --post-count 288 `
  --order-count 160 `
  --seed 173
```

最後才在 SSMS 或 `sqlcmd` 執行後台專用情境：

```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -d QMAH -E -f 65001 -b -r1 -i .\database\seed-admin-showcase-data.sql
```

資料工具會管理一批 288 篇不同主題的貼文、672 筆留言、160 筆訂單與 96 筆商品評價；貼文大約分成 96 篇文物專題、41 篇鑑定遊戲交流、112 篇一般社群內容、7 篇實際活動貼文與 32 篇官方公告。每篇貼文至少有兩筆留言，每三篇再加入一筆回覆；社群文章採固定順序的獨立素材，不會因亂數重新拼接成對不上的內容。只有部分貼文連到文物，避免把所有館藏都安排成有人討論；每筆訂單至少有一項與文物直接關聯的縮小複製品，訂單明細保留成交時的商品名稱與單價快照，商品評價也會使用實際的縮小複製品與關聯文物。相同參數可以安全重跑，工具只更新自己產生的資料，不會刪除其他資料；這些是工具批次數量，不是還原後要補上的數量，完整 snapshot 的實際總數以 [`02-development-data.md`](02-development-data.md) 為準。

`seed-admin-showcase-data.sql` 只補活動、檢舉、成就、優惠券與會員管理情境，不建立 Schema、不使用 Migration，也不會由網站啟動時自動執行。`seed-showcase-data.sql` 仍保留為固定 SQL 的相容性補充；這兩份腳本都不是一般組員還原後的步驟。要重建完整 reference snapshot 時，依 [`database/README.md`](../database/README.md) 的 Release 流程處理，成功驗證後才把結果交給組員。

## 展示資料範圍

- 256 件文物、256 筆題庫設定與 256 件對應商城商品保持完整。
- 遊戲有多個房間、玩家、回合、作答與投票，涵蓋等待、進行、完成與取消狀態。
- 社群有不同板塊的長篇文物觀察、來源查證、保存討論、問題求助、閱讀指南、鑑定遊戲交流、活動資訊、平台使用經驗與官方公告；只有文物專題與部分遊戲回合會連回實際文物，留言則以父子回覆保留討論脈絡。
- 商城有多種訂單與付款結果，包含待付款、已付款、處理中、出貨、完成與取消等情境；訂單商品只來自目前資料庫中的文物縮小複製品，並保留多商品、數量與成交快照。
- 商城商品有星等與簡短心得，公開內容只計入已發布評價；目前會員可新增、修改或刪除自己的評價，後續前台可以同時顯示平均分數、留言與是否有購買紀錄。
- 會員資料與內容資料維持相近規模，避免會員只有幾個、訂單或貼文卻異常大量。
- 目前完整 snapshot 已包含上述社群、商城與遊戲情境；社群圖片上傳是獨立於官方文物圖鑑圖片的資料邊界，尚未上傳時 `MediaAssets` 可以是空表。

完整筆數與狀態分布見 [`02-development-data.md`](02-development-data.md)。個人測試新增的資料可以不同，不要為了讓數字看起來一樣而覆蓋其他組員的本機資料庫。

## 展示帳號

`seed-showcase-users` 會建立或更新 24 個本機展示會員、`Admin` 與 `User` 角色，預設讀取 Repository 根目錄的 `QMAH.DemoCredentials.local.csv`，並在同一位置建立 `QMAH.DemoCredentials.local.backup.csv`：

展示會員的公開顯示名稱刻意使用 `Demo Admin`、`Demo Member 01`、`Demo Catalog` 等英文用途名稱，不對應真實人物；功能性 Email 與角色仍維持固定，方便組員依情境登入。

- Repository 根目錄的 `QMAH.DemoCredentials.local.csv`
- Repository 根目錄的 `QMAH.DemoCredentials.local.backup.csv` 備份

根目錄的 `QMAH.DemoCredentials.csv` 是可提交的空白密碼範本；請先複製成 `.local.csv`，再填妥 24 個帳號的 Password。工具找不到檔案，或發現任何帳號的 Password 留白時會直接停止，不會自動產生密碼。`.local.csv` 與備份檔已列入 `.gitignore`，不應提交到 Repository。明確傳入 `--credentials` 與 `--backup` 時，仍可使用其他本機路徑；為相容既有設定，根目錄沒有檔案時也會檢查 Repository 上一層的舊版位置：

| 帳號 | 用途 |
| --- | --- |
| `admin@qmah.local` | 後台與營運中心管理員 |
| `catalog@qmah.local` | 文物圖鑑情境 |
| `game@qmah.local` | 遊戲情境 |
| `social@qmah.local` | 社群與活動情境 |
| `store@qmah.local` | 商城情境 |
| `user@qmah.local` | 會員、地址與個人資料情境 |
| `player-a@qmah.local`、`player-b@qmah.local` | 遊戲玩家情境 |

若忘記展示帳號密碼，可使用工具重新設定單一帳號：

```powershell
dotnet run --project .\tools\QmahDataTools\QmahDatabaseRelease\QmahDatabaseRelease.csproj -- `
  reset-password `
  --connection "Server=(localdb)\MSSQLLocalDB;Database=QMAH;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=False" `
  --email admin@qmah.local
```

不指定 `--password` 時，單一帳號重設工具會讀取根目錄本機憑證檔中該帳號的 Password；找不到或留白時會直接提示補齊，不會產生隨機密碼。需要更換密碼時，請明確傳入 `--password`，工具會同步更新本機憑證檔。不要把 CSV、密碼、Cookie、Token 或含有個人資料的本機 log 加入 Git；若改在可由外部連線的主機展示，先替換所有展示密碼。

## 啟動展示

1. 確認 `QMAH.Web/appsettings.Local.json` 與 `QMAH.Api/appsettings.Local.json` 指向同一個 `QMAH`。
2. 啟動 `QMAH.Web`，登入後台查看五個 Area 與「營運中心」。
3. 需要 API 時，再啟動 `QMAH.Api`；前台骨架使用 VS Code 的 API＋Angular 複合啟動。
4. 從營運中心選擇 90、180 或 365 天，查看月份彙總、逐日資料、訂單狀態、遊戲、社群、活動與社群圖片分布。
5. 若要測試圖片管理，使用 API 上傳一張合規圖片，再從營運中心查看預覽、隱藏與恢復；官方文物圖鑑圖片不會出現在社群圖庫。

展示完成後可保留本機資料庫供下次使用。只有要重新建立共同 reference snapshot 時才執行完整匯出與 parity validation；不把本機資料庫檔、seed 執行 log 或上傳圖片提交到 Repository。
