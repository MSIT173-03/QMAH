# QMAH 資料工具

本目錄保存 QMAH 資料收集、標準化、商品產生、匯入預檢與參考資料庫匯出的原始碼。工具輸出放在 Repository 外層 `_工具輸出`，不提交 raw、快取、Log、可執行檔或資料庫備份。

一般網站開發只需還原 GitHub Release 的 `.bak`。本目錄由資料庫與資料整合流程使用，不是網站啟動必要步驟。

## 使用哪個工具？

| 工具 | 用途 | 詳細說明 |
| --- | --- | --- |
| `NpmArtifactPipeline` | 文物 API、圖片、年代規則、品質報告 | [`NpmArtifactPipeline/README.md`](NpmArtifactPipeline/README.md) |
| `NpmShopSampleCollector` | 商城分類觀察、商品收集與來源分類保留 | [`NpmShopSampleCollector/README.md`](NpmShopSampleCollector/README.md) |
| `ArtifactProductGenerator` | 由 CC BY 4.0 文物產生縮小複製品、說明與可重現整數價格 | [`ArtifactProductGenerator/README.md`](ArtifactProductGenerator/README.md) |
| `NpmDataImporter` | 8 類文物資料包預檢與安全匯入；舊商城資料匯入僅保留相容性 | [`NpmDataImporter/README.md`](NpmDataImporter/README.md) |
| `NpmDataWorkbench` | Windows GUI，執行資料估算、整理、預檢與舊來源研究 | [`NpmDataWorkbench/README.md`](NpmDataWorkbench/README.md) |
| `Export-ReferenceDatabase.ps1` | 建立並驗證最新參考 `.bak` | [`../database/README.md`](../../database/README.md#建立新的參考-bak) |

## 固定資料基準

### 文物 8 類

圖鑑與遊戲共用：`BRONZE` 銅器、`CERAMIC` 陶瓷、`JADE` 玉器、`ENAMEL` 琺瑯器、`LACQUER` 漆器、`COIN` 錢幣、`CARVING` 雕刻、`PAINTING` 繪畫。

選擇標準是資料量可以持續增加、圖片有清楚的材質／器形／構圖線索，且一般玩家能只看圖猜出合理方向。其餘 8 個 API 類別仍可用 `--all-categories` 審核，但不會混入正式分類。匯入最低門檻是每類 32 筆（至少 256 筆），題庫還要通過 `AUTO_VERIFIED`、單一年代桶與圖片清楚等門檻。

### 文物與商品一對一

正式展示商品由 `ArtifactProductGenerator` 從已授權文物產生。目前 256 件文物對應 256 件商品，分類代碼相同，圖片共用 Catalog 路徑。價格依年代、分類與固定 seed 加權，並輸出可稽核的拆解資料。

商城分類收集器保留作為來源網站結構與分類研究工具，不再提供正式專題商品圖片或售價。若未來取得適當授權且確實需要來源商城素材，可另行評估舊流程，不與目前文物轉商品流程混用。

## 穩定擴充方式

資料流程固定分為三層，避免來源 API 變更直接影響網站資料表：

```text
故宮 API 與典藏詳細頁
        ↓
來源層：完整保存 n 筆原始回應、擷取時間與狀態
        ↓
標準層：依 ArtifactRef 整理成一致的文物主檔
        ↓
應用層：由同一主檔分別產生 Artifact 與 Product
```

來源層應盡可能保留官方可提供的欄位，例如文物編號、名稱、16 類原分類、年代原文、作者或製作者、尺寸、材質、技法、數量、說明、來源網址、圖片網址、授權與姓名標示。未知欄位也保留在原始 payload，不因目前資料表沒用到就丟棄。raw、HTML、快取與大量 JSON 只放 `_工具輸出`。

標準層負責欄位名稱、尺寸格式、年代桶、8 類正式分類、缺值狀態與授權檢查。來源寫「待測量」就保留原文，不改成推測數字。每筆資料要記錄來源 ArtifactRef、擷取時間、解析版本與品質狀態，讓下次只更新缺漏或過期項目，不必重新抓全部資料。

應用層才做用途差異：

- Artifact 保存官方文物事實，供圖鑑與遊戲使用。
- Product 以 `ArtifactId` 連到文物，再加入換算後的商品尺寸、商品文案、價格、庫存與上架狀態。
- `ExternalRef` 只供資料交換與查重，不作為程式關聯。

目前 `NpmArtifactPipeline` 已保存 API 原始 payload、圖片、年代與品質報告，但詳細頁的作者、材質、技法與數量尚未形成完整的通用擷取階段。未來擴充應加在來源層，不要直接把詳細頁解析邏輯塞進 Product 產生器。

## 工作流程

```text
估算 16 個文物端點
        ↓
每類少量收集，檢查圖片、年代、來源與授權
        ↓
增加到 8 類 × 32 筆並完成文物匯入
        ↓
NpmDataImporter 預檢（不帶 --apply）
        ↓
人工確認 APPROVAL_TOKEN
        ↓
在已由 SQL Server／SSMS 建立並核對的 QMAH DB 執行 --apply
        ↓
ArtifactProductGenerator 為全部合格文物建立對應商品
```

SQL Server Schema／ERD／`database/Schema.sql` 是資料庫契約；Entity 與 `QmahDbContext` 只做對照。

Repository 不使用 EF Migration；資料包更新不改變資料庫 Schema 的設計來源。

一般網站開發從 Release 還原 `.bak`，不執行本目錄的資料匯入命令。

## 原始碼建置

需要 .NET 10 SDK：

```powershell
dotnet build .\NpmArtifactPipeline\NpmArtifactPipeline.csproj
dotnet build .\NpmShopSampleCollector\NpmShopSampleCollector.csproj
dotnet build .\ArtifactProductGenerator\ArtifactProductGenerator.csproj
dotnet build .\NpmDataImporter\NpmDataImporter.csproj
dotnet build .\NpmDataWorkbench\NpmDataWorkbench.csproj
```

建置完成的自包含執行檔放在工作區根目錄 `_工具輸出/portable-tools/`。

GUI 與 CLI 共用同一批分類、年代與品質規則，不會複製另一套資料契約。

## 輸出界線

所有 raw、processed、preview、快取、log、bin、obj、大型 EXE 與媒體都放工作區根目錄 `_工具輸出`，不進 Git。

網站資料庫只保存 `/media/` 起算的相對圖片路徑。

正式匯入前不得直接執行 `*.upsert.sql`。
