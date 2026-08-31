# NpmArtifactPipeline

把故宮數位典藏 Open API 整理成「圖鑑與遊戲共用」的文物資料包。工具只負責讀取來源、下載圖片、判讀年代與產生檢查檔；不連線 SQL Server，也不直接寫入網站資料庫。

## 固定規則

1. **正式基準是 8 類**，圖鑑和遊戲使用同一份分類與同一筆文物主檔。
2. **圖片要能讓玩家猜**：保留主體清楚、具材質或造形辨識度的資料；資料缺圖、主體不清或年代無法可靠判讀時，不進題庫。
3. **SQL Server 優先**：資料庫 Schema／`database/Schema.sql` 是結構契約，Entity 與 `QmahDbContext` 只做對照。這個工具產生的 `*.upsert.sql` 僅供核對，不取代正式 DB 變更流程。

直接雙擊 `NpmArtifactPipeline.exe` 且沒有參數時會立即結束，不會自行執行。請從命令列帶參數，或由 `NpmDataWorkbench.exe` 的文物頁呼叫。

## 正式 8 類

| 代碼 | 中文 | API 資料集 | 為何保留 |
| --- | --- | --- | --- |
| `BRONZE` | 銅器 | `bronzes` | 器形、紋飾與材質明顯，容易建立視覺題 |
| `CERAMIC` | 陶瓷 | `ceramics` | 器形、釉色與工藝差異可由圖片辨識 |
| `JADE` | 玉器 | `jades` | 材質、雕琢與禮制脈絡兼具，資料量足夠 |
| `ENAMEL` | 琺瑯器 | `enamelWares` | 色彩與金屬胎工藝辨識度高 |
| `LACQUER` | 漆器 | `lacquerWares` | 漆色、器形與工藝特色適合看圖猜 |
| `COIN` | 錢幣 | `coins` | 圓形、文字、紋樣與政權線索清楚 |
| `CARVING` | 雕刻 | `carvings` | 立體造形與材質明顯，資料量可支撐擴充 |
| `PAINTING` | 繪畫 | `paintings` | 題材、構圖與畫面風格能提供視覺線索 |

這 8 類是目前專題的固定基準，不因單次 API 缺漏而臨時換類。16 個來源端點仍會保留在目錄中，另外 8 類只作可用量與品質審核：文具、雜項、織品、絲繡、法書、法帖、拓片、成扇。法書／成扇的完整年代資料比例過低，文具與拓片等類別也較難讓一般玩家只靠圖片猜出穩定答案，因此不納入正式題庫基準。

後續資料量增加到 2～3 倍時，只替換同一類中的單筆資料，不改分類代碼。8 類各 32 筆是匯入最低門檻，正式展示可再擴充到每類 40 筆以上，總量自然由 256 筆往上增加。

## 常用指令

```powershell
.\NpmArtifactPipeline.exe --help
.\NpmArtifactPipeline.exe --estimate-only
.\NpmArtifactPipeline.exe --per-dataset 1 --output .\output\smoke --media-root .\output\media
.\NpmArtifactPipeline.exe --bronze 32 --ceramic 32 --jade 32 --enamel 32 --lacquer 32 --coins 32 --carvings 32 --painting 32 --output .\output\current --media-root .\output\media
```

`--estimate-only` 只讀取 16 個 API 陣列筆數，不建立 output、不下載圖片。若預設連線路徑逾時，工具會使用 IPv4 連線；仍失敗時請看 `ESTIMATE_FAILED`，不要以其他分類硬湊數量。

指定單類數量時，參數名使用資料集檔名：`--bronze`、`--ceramic`、`--jade`、`--enamel`、`--lacquer`、`--coins`、`--carvings`、`--painting`。`--per-dataset` 只會套用到正式 8 類；`--all-categories` 另輸出 8 個保留來源類別，僅供人工審核。

## 來源與品質規則

工具直接讀 API JSON，不解析展示頁 HTML，也不從搜尋結果補資料。每筆資料會保留來源編號、來源網址、授權／標示、原始分類與圖片網址。`source-catalog.json` 是 16 類來源目錄；正式輸出只取上表 8 類。

年代欄位永遠保留原文，並另外輸出穩定的年代桶、命中規則、信心度與人工確認原因。只有符合下列條件的資料才標示為可出題：

- 年代能由規則自動判讀為單一年代桶，且信心度為 `AUTO_VERIFIED`。
- 沒有跨年代、模糊世紀、日治年號或需要人工猜測的情況。
- 有可讀的主圖，主體沒有被裁切、遮擋或大量文字／量尺卡片干擾。
- 名稱、描述、來源網址與授權標示完整。

不符合條件的資料仍可留在圖鑑候選或品質報告，但不可拿來要求玩家猜單一年代。完整規則與排除原因會寫入 `quality-report.json`。

## 輸出結構

預設輸出根目錄是工作區的 `_工具輸出`，也可以用 `QMAH_TOOL_OUTPUT`、`--output` 與 `--media-root` 指定：

```text
_工具輸出/current/
├─ raw/                         # API 原始回應
├─ processed/                   # 正規化 JSON／CSV
├─ import/
│  ├─ artifacts.import.json     # 匯入器讀取的資料包
│  ├─ artifacts.csv             # 人工檢查用 CSV
│  └─ artifacts.upsert.sql      # SQL Server 契約核對用，非直接寫入流程
├─ quality-report.json          # 缺欄位、缺圖、年代與排除原因
└─ manifest.json
_工具輸出/media/                # display／thumbnail 圖片檔
```

raw、processed、preview、快取、log、bin、obj 與大量圖片不得放進 Git。網站資料庫只保存 `/media/` 起算的相對路徑，例如 `/media/catalog/BRONZE/123/display.jpg`。

## 與 SQL Server 的關係

目前採 SQL Server DB-first：先以 SQL／ERD 確認 Schema，再讓 Entity 與 `QmahDbContext` 對照。`database/Schema.sql` 用來檢查空白資料庫應得到的第一版結構；Repository 不使用 EF Migration。匯入器的正確順序是「資料包預檢 → 人工確認 → 在已建立的 QMAH 資料庫執行匯入」，本工具本身不建立資料庫。

正式表只涉及：

- `catalog.ArtifactCategories`：8 個穩定分類代碼與名稱。
- `catalog.EraBuckets`：年代桶與起訖年份。
- `catalog.Artifacts`：文物名稱、來源編號、原始年代、描述、圖片相對路徑、來源與授權。

類別與年代順序由程式查詢規則固定，不是匯入資料可任意新增的欄位。

## 失敗時怎麼看

先跑 `--estimate-only`，再用小量（例如每類 1～5 筆）驗證。重點檔案如下：

- `ESTIMATE_FAILED`：API、DNS、連線或回應格式問題。
- `quality-report.json`：缺圖、缺欄位、年代信心度與排除原因。
- `manifest.json`：本次參數、來源與輸出位置。

API 暫時沒有回應時先停止增加請求量，確認端點、IPv4 路徑與節流設定；不要把失敗類別改成另一個類別，也不要臆造年代。
