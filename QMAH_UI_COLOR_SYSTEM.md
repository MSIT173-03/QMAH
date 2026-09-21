# 清明鑑定屋前台色彩與視覺素材基準

> 狀態：第一階段落地基準。更新日期：2026-09-20。這份文件是目前前台共用色彩、Area 語意色與視覺素材的工作基準。它不是新的資訊架構，也不是要求每個頁面套同一種版型。

## 這一輪要解決什麼

目前前台的主要問題不是「缺少更多顏色」而已，而是顏色、表面、互動狀態和內容素材沒有分清楚責任：有些頁面只剩單一綠色，另一些頁面則需要靠裝飾才看得出層級；圖鑑篩選器在窄欄時又容易把長標籤壓壞。

本輪採用短線可驗收的範圍：

1. 以 shared token 統一 canvas、surface、text、border、focus 與 semantic state。
2. 為五個功能系統建立低彩度但可辨識的 Area accent，讓頁面有自己的氣質，仍屬於同一個產品。
3. 將 UI 素材和內容照片分開：色彩線、分隔線、淡色 surface、狀態標記服務層級；stock photo 只在有內容語意的區塊出現。
4. 用 intrinsic grid、可換行標籤與清楚的 selected state 修正圖鑑篩選器，不以 `overflow: hidden` 藏掉內容。
5. 深色模式重新映射 surface、文字與 Area accent，不直接把淺色模式反相。

## 色彩方向：Committed Museum

整體氣質是「文物檔案的安靜底蘊，加上當代展覽導引的色彩」。Jade Green 保留品牌辨識；Air Blue、Navy Peony、Potter's Clay 和 Honey Gold 拉開五大系統的距離。顏色主要承擔導覽、選取、分組、狀態和少量視覺焦點，不把每個區塊都塗滿。

建議比例只是工作護欄，不是硬性規則：大約 60–70% 為帶有品牌傾向的中性 surface，20–30% 為 Area 或 semantic 色的淡色表面與線條，強烈 action／accent 低於 10%。內容密集的頁面可以更安靜；Hero、公告或空狀態才使用較大的色面。

### Pantone 參考與數位使用方式

Pantone 色票用來確認色彩的命名、家族與文化氣質，不把螢幕上的 HEX 當成 Pantone 的精確等值。官方頁面也提醒，網頁顯示是電腦模擬，若進入印刷或實體製作，仍應以實體色票為準。

| 角色 | Pantone 參考 | 前端工作色 | 原因 |
| --- | --- | --- | --- |
| 品牌主軸 | [16-0228 TPG Jade Green](https://www.pantone.com/hk/tc/color-finder/16-0228-tpg) | `#26796E` / `oklch(52.4% 0.080 183)` | 保留清明鑑定屋既有玉石綠，不讓新配色失去辨識度。 |
| 清爽輔色 | [15-4319 TCX Air Blue](https://www.pantone.com/eu/fr-fr/color-finder/15-4319-tcx) | `#527F99` / `oklch(57.4% 0.064 235)` | 給圖鑑與資料導覽一個冷靜、清楚的索引色。 |
| 深色基底 | [19-4029 TCX Navy Peony](https://www.pantone.com/color-finder/19-4029-tcx) | `#334260` / `oklch(38.0% 0.055 264)` | 適合遊戲與深色內容的安定背景，不使用霓虹藍紫。 |
| 暖金輔助 | [15-1142 TCX Honey Gold](https://www.pantone.com/hk/en/color-finder/15-1142-TCX) | `#B7914F` / `oklch(67.8% 0.096 80)` | 給商城、收藏與獎勵少量溫度；不直接當正文色。 |
| 赭土撞色 | [18-1340 TPG Potter's Clay](https://www.pantone.com/color-finder/18-1340-tpg) | `#B86F5B` / `oklch(61.7% 0.098 36)` | 給社群與活動較有人情味的提示；使用深色 action 變體承擔白字。 |
| 紙張中性 | [Fashion, Home + Interiors](https://www.pantone.com/na/en-us/fashion-home-interiors) 的紙張／布料色票作參考 | `#F8F6EF` / `oklch(97.3% 0.010 94)` | 取代死白，讓畫面保留紙墨與展冊的溫度。 |

工作色是 UI 的近似值，不是 Pantone 授權色票的替代品。顏色轉換後仍須以實際瀏覽器對比結果為準。

## Primitive 與 semantic token

Primitive 是可被調整的色彩材料；semantic token 才是元件真正應依賴的角色。頁面不要直接散落 HEX，也不要把 Area accent 當成成功、錯誤或停用色。

### 共用角色

| Token 角色 | 淺色用途 | 深色用途 | 使用情境 |
| --- | --- | --- | --- |
| `paper` / `surface` | 暖紙白、帶青綠的淡表面 | 低彩度藍灰炭黑、明確分層的 elevated surface | 頁面底、卡片、表單 |
| `ink` | 深墨青 | 暖白青 | 正文、標題、主要資料 |
| `muted` / `subtle` | 降低明度但仍可讀 | 提高明度，不使用灰到看不見 | 輔助說明、metadata |
| `primary` | 深玉石綠 | 明亮玉石綠 | 主要 CTA、品牌導引 |
| `focus` | 暖金 | 明亮暖金 | 鍵盤 focus 與重要操作提示 |
| `border` | 青灰線 | 低對比亮線 | 分隔、輸入框、卡片邊界 |
| `success / warning / danger / info` | 全站固定語意色 | 各自有深色變體 | 狀態；不能由 Area accent 取代 |

正文與主要控制項以 WCAG AA 為最低門檻：正文至少 4.5:1，大字至少 3:1，控制邊界與 focus 至少 3:1。中間明度的 Air Blue、Honey Gold、Potter's Clay 不直接拿來放小字；必要時使用對應的深色 action token。

## 五個功能系統的色彩語意

每個 Area 只需要一個主要辨識色、一個深色 action、一個淡色 surface。它們用在頁面標題、選取、局部導引、裝飾線與少量 CTA，不改變各系統原本合理的資訊架構。

| 系統 | 語意 | accent | action | soft surface | 適合放在哪裡 |
| --- | --- | --- | --- | --- | --- |
| 會員中心 | 收藏、信任、持續累積 | Jade Green `#26796E` | Deep Jade `#145A53` | `#D7EBE6` | 會員摘要、資產與個人操作 |
| 圖鑑鑰匙 | 索引、資料、探索 | Air Blue `#527F99` | Deep Azurite `#3D687D` | `#DCEAF0` | 篩選器標題、選取狀態、圖鑑 metadata |
| 遊戲大廳 | 回合、判斷、集中注意 | Navy Peony `#334260` | Navy Peony `#334260` | `#E3E7F0` | 房間選取、等待與遊戲入口 |
| 社群廣場 | 對話、活動、溫度 | Potter's Clay `#B86F5B` | Deep Clay `#985545` | `#F0DFD8` | 公告、活動、社群互動提示 |
| 購物商城 | 選品、收藏、價值 | Honey Gold `#B7914F` | Deep Honey `#8A6B2C` | `#F3EAD4` | 商品分類、收藏、優惠與購物導引 |

登入頁、真首頁與管理入口先使用共用品牌色與中性 surface，不為了湊滿五色而硬塞 Area 色。狀態色仍維持全站一致：成功、警告、錯誤、資訊要靠文字／圖示／位置共同表達，不能只靠色相。

## UI 素材與內容照片是兩條不同工作線

### UI 素材：用來建立完成度與節奏

可以優先加入的不是隨機背景，而是能說明層級的細節：

- 以 Area accent 做 1px–2px 的分隔線、選取底色和標題下劃線。
- 以淡色 surface 區分 filter、announcement、hero supporting panel，而不是每一塊都做成卡片。
- 在真首頁或社群公告使用一種低對比的紙張／檔案索引紋理；不能蓋住正文，並可在 `prefers-reduced-motion` 下靜止。
- 以既有字體階層、留白、邊框和狀態 feedback 增加完成度，不使用霓虹 glow、廉價玻璃擬態或無意義 floating blob。
- 圖鑑篩選器使用欄位分組、清楚的 checked state 和固定的控制高度，讓「好看」與「找得到」同時成立。

### Stock photo：用來承載內容語意

照片不是 UI 素材的替代品，第一階段只挑 3–4 個有必要的內容位置：

1. 真首頁：一張有空間感的博物館／院區建築或空拍，作為認識「兩種文物探索方式」的文化隱喻。
2. 社群公告／活動：一張與公告主題直接相關的展覽或文物細節照；沒有對應內容時寧可用現有素材，不新增假新聞感封面。
3. 商城品牌／選品區：一張材質、工藝或文物細節照，服務選品敘事，不拿 generic 商務 stock photo 填空。
4. 登入頁：維持既有故宮院區與清院本素材；不再追加會壓縮登入表單的裝飾照片。

Catalog 卡片優先使用真實文物圖片，不用 stock photo 代替文物。每張外部照片都要留下來源與授權、設計 `alt`、使用 lazy loading，依畫面裁切提供 WebP／AVIF 或適當 `srcset`；沒有合法來源與內容語意的照片不進產品。

## 短線落地順序與完成條件

### A：共用基線（先完成）

- shared `qmah`／`qmahdark` token 使用上述角色與五個 Area mapping。
- App Shell、商城、會員、圖鑑、遊戲、社群不各自覆寫同一語意。
- Catalog filter 在 320／390／768／1440px 都能看完整標籤、點擊完整控制，checked state 不只靠色彩。
- Light／dark 都檢查正文、控制項、focus、disabled、空狀態與 overlay 對比。

### B：有限視覺素材（第二個短工作單元）

- 只挑真首頁、社群公告、商城選品 3 個區塊做照片或既有素材配置。
- 只增加有語意的分隔線、淡色 surface 或局部 texture；不重排 IA、不新增大型 design abstraction。
- 每個素材都保留來源、授權、alt 與 responsive crop。

### C：一次驗收

- Frontend production build。
- Catalog 篩選器與圖鑑卡片 desktop／mobile smoke。
- 五大系統各抽一個代表頁，檢查 light／dark、keyboard focus、hover／selected／disabled。
- 確認沒有水平溢出、文字孤字、長標籤裁切、照片載入失敗或把裝飾誤認為內容。

這三個工作單元完成後，才重新評估是否需要更細的局部 polish；不因 detector warning 自動擴張成全面 redesign。
