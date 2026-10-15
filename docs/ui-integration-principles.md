# QMAH 前台 UI 整合目標與原則

## 目標

以目前已整合完成的遊戲前台作為視覺與互動基準，讓 User、Catalog、Game、Social、Store 明顯屬於同一個 QMAH 產品。第一輪維持 User、Catalog、Social、Store 原有的版面大方向與資訊架構；Game 是本輪視覺基準，也是可較大幅強化的例外，但仍保留既有遊戲流程、Route、API 與商業邏輯。

本輪工作的重點是共用 App Shell、跨 Area 導覽、Detail 返回路徑、視覺語法收斂與 Desktop / Tablet / Mobile 可用性，不是重新設計產品或補做新功能。

## Current Goal

目前目標是完成清明鑑定屋前台整合的可交付收尾：保留 User、Catalog、Game、Social、Store 的資訊架構、主要版面方向與核心流程，先修正商城商品清單／縮圖無法正常工作的資料契約與媒體路徑，再以小幅 Store polish 收斂圖片 surface 與圓角規則。商城價格必須由後端統一計算：`DiscountRate` 支援管理員批次套用，`SalePrice` 支援管理員指定 199／299 等明確折扣後售價；有效 `SalePrice` 優先，否則依 `DiscountRate` 計算，訂單與購物車共用同一規則。完成後同步更新 `QMAH-Database` 的 `db-v0.10.0` Snapshot、公告日期與升級文件，並以必要的 build、API／資料庫與代表性瀏覽器流程驗證，不擴張成全站 redesign。

登入頁桌面維持畫卷主視覺加右側登入；手機先呈現品牌列與登入表單，再進入畫卷鑑賞，不把桌面浮卡縮小套用到手機。全站採 Noto Sans TC／Noto Serif TC web font 加系統 fallback，並以共用主題 token 支援深淺模式；Game 頁面保留既有大廳、房間、練習與結算流程，不新增假功能或假資料。

### Scope Boundary：保留大方向，允許風格統一

圖鑑、社群、會員中心與商城不是凍結區，而是本目標必須實際檢查與修整的範圍。可以在不改大方向的前提下收斂 typography、色彩角色、間距、按鈕、表單、卡片、狀態、共用導覽、RWD、accessibility、文案與重複樣式；只有實際 usability blocker 才能重排或 rewrite，並留下保留邊界與修改理由。不因為統一視覺而強迫不同用途頁面套成同一模板，也不新增沒有真實資料或 route 支持的功能入口。

登入後與網站根路徑使用內容型首頁作為共同落點：首頁提供既有 Area 的真實入口、清楚的下一步與少量故宮脈絡，不套用後台 dashboard，也不虛構推薦、活動或進度數字。

Game 的品質門檻同時包含 Usability 與 Modern Visual Quality：玩家第一次進入時要知道目前狀態、下一步目標、主要內容與主要操作；畫面也要具備可正式 Demo 的層級、節奏與完成度。可用性不能把 Game 做成灰色後台，視覺精緻也不能用漸層、玻璃效果或動畫掩蓋操作問題。

本目標持續使用 `impeccable` 作為 UI 設計審查門檻，並用 `speak-human-tw` 審查使用者可見文案。deterministic detector、source、build、tests 與 runtime 證據先回答可直接確認的問題；剩餘可縮成分類、排序、優先級、routing、review signal 或 gate 的主觀判斷，使用 Jev 做 bounded 快速分流，再由主模型與 Impeccable 處理真正的設計決策。每完成一個完整 UI 工作單元，至少要完成一次設計 critique、一次 detector／技術 audit 與代表性瀏覽器證據；集中檢查 320／390／768／1024／1440px、深淺模式、reduced motion、鍵盤焦點與主要互動，不因小修改反覆重跑整個 Repository。任何 audit 發現「看不懂、找不到、狀態互相干擾」時，下一步先減少操作與視覺噪音，再考慮增加動畫或裝飾。

可見文案與品牌區另有一道不可省略的視覺 gate：逐一查看代表尺寸的實際截圖，確認繁中標題與說明不出現孤字、硬切、被 line-clamp 隱藏、貼邊或超出容器；Logo、metadata、控制項在實際背景上必須有足夠辨識度。`build`、detector 或單看 DOM box 通過，不能取代這項人工視覺確認。

## 不可偏離的範圍

- 先 reuse 現有 shared component、layout、route 與樣式，再做 adapt、small visual adjustment；只有現有結構確實無法支援時才 rewrite。
- 以遊戲頁面的清楚層級、留白、色彩對比、可操作狀態與內容節奏作為共同基準；其他 Area 可以保留自己的構圖，不強迫套成同一張模板。
- User、Catalog、Social、Store 以既有 composition 為邊界，採 `impeccable` 的 pro max polish：強化資訊層級、狀態、間距、可讀性、可操作性與 RWD，不因個人偏好大改內容排列。
- Game 可以較大幅整理視覺層級、版面細節與 responsive composition，因為它是本輪指定的核心頁面與統一語言來源；但不得藉此新增遊戲功能或改動既有 API、流程與資料契約。
- Game 的既有操作鏈要被視為一個完整產品流程：大廳選房／建立或加入 → 房間等待與準備 → 回合作答 → 投票 → 揭曉／結算 → 領取既有獎勵 → 返回大廳。可以重整畫面順序、出口、確認與 feedback，不能跳過既有狀態、虛構資料或改造 API；每個狀態都要有清楚的「現在在哪裡、接下來會發生什麼、如何安全離開」。
- Game 大廳的首要任務是找房、建立、加入與查看房間；多人與單人入口、玩法說明必須透過同一組清楚的 Game 子導覽切換。玩法說明放在獨立的說明頁／分頁，一次只呈現一種玩法，不把長篇教學常駐塞進大廳或遊戲操作區。
- Game 的介紹 Hero 預設收合但可主動展開；收合狀態以 localStorage 保留，讓玩家回到大廳時能直接查看房間。展示／預覽模式只對管理員顯示入口與標示，一般玩家不應看到開發用字樣。
- Game 大廳的房間索引要先完成找房任務：清單欄位用固定標籤與穩定對齊建立掃讀節奏，不能用過度留白撐滿畫面；玩家選房後以可關閉、可 Escape、可由背景點擊關閉的詳情對話框呈現設定、席位與既有加入操作，不把清單擠成並排詳情欄。
- Game 大廳要提供清楚的「重新整理」按鈕；展示模式除了手動刷新，也要以可清理的定時輪詢重算房間列表，正式 API 仍沿用既有房間查詢契約，不能為 UI 另造資料來源。
- `/game/test` 是正式網站中的「管理員遊戲檢查中心」，由 route guard 與目前登入帳號的 `Admin` role 保護；它提供可重複加入的前端隔離測試房間與既有遊戲 API 的只讀煙霧檢查，讓管理員能長期確認前台流程與服務連線，而不是只在 development mode 才存在的臨時頁面。
- 測試房間重用正式 `GameRoomComponent`，自動走過等待、作答、投票、揭曉與結算，並提供暫停、逐階段、重新開始與返回檢查中心控制；測試流程不得呼叫正式房間加入／作答／投票／獎勵 API，也不得寫入會員、房間或獎勵紀錄。真正的基礎設施健康度若日後需要精準監控，應另接後端 health endpoint，不把前端煙霧檢查冒充成伺服器監控。
- 測試房間的控制工具不得改變正式房間的版面重心：預設以低干擾、可鍵盤操作的浮動 QA 入口收合，只有展開時才顯示測試訊息與階段控制；管理員可從 Game 子導覽一鍵進入檢查中心與測試房間，普通玩家不顯示測試入口，也不能以 `?test=1` 直接繞過 route guard。
- 只連到實際存在的 route，不建立假的導覽項目、空殼頁面、Wishlist、Filter 或其他未完成產品功能。
- 不修改 API business logic、economy / reward logic、auth architecture 或既有 canonical contract；本輪獲明確授權的商城資料層調整僅限 `DiscountRate` 批次折扣、`SalePrice` 指定折扣後售價與共用 `EffectivePrice` 規則，必須從 schema、Snapshot、型錄、購物車到訂單使用同一個有效售價規則，不能只做前端假折扣。
- 不以大型 design system、元件抽象或依賴套件取代目前可用的局部修正。
- Admin 可以保留自己的管理導覽與版面；前台 global navigation 不應破壞既有 Admin flow。
- 每一項 UI、Route、Shared Layer、Layout ownership、Navigation behavior 或 RWD behavior 改動，都要在程式碼附近留下清楚易懂的繁中 `ui-integration` 原因註解，讓長時間任務後仍能看懂「為什麼改」與「刻意保留什麼」。TypeScript / HTML 使用 `// ui-integration:`，SCSS / CSS 使用 `/* ui-integration: ... */`；純單點 spacing / typography / class 微調可用區塊註解，不必逐行污染。
- 前台樣式統一使用 SCSS：`src/styles.scss` 是全域入口，元件與頁面使用同名 `.scss`；不新增純 CSS／inline `styles` 雙軌。只有在既有樣式確實被本輪觸碰時才做最小轉檔，避免為了格式統一製造無關 diff。
- 前台功能圖示統一使用固定版本的 `@lucide/angular`，目前鎖定 `1.47.0`；不得因為「安裝最新」而讓 Angular 21 專案的相容性漂移。功能圖示不得再以 emoji、`ICON`、`IMG` 或手工混搭的 icon library 充當正式 UI；必要時透過 `QmahIconComponent` 保持語意名稱、尺寸與筆畫一致。
- 圖鑑鑰匙是例外的內容型道具，不使用通用功能圖示取代。四把的正式 art-direction 以以下 geometry spec 為唯一驗收基準：母圖 `1254 × 1254 px`、RGBA 真透明、bit 在左下、head 在右上、長軸約 40–45°、近正投影且無 cast shadow；物件占畫布約 78–82%，四周保留約 9–11% 安全距離，head 約 29–33%、shaft + bit 約 67–71%，可見 shaft 約 420–465px、bit 最大約 165 × 180px，光影最多亮面／主面／暗面三階。
- 四把必須共享相同 shaft 尺度、輪廓處理、QMAH 瓷青 collar（主色 `#638D97`、亮面 `#91B3BA`、暗面 `#435F68`）與 40–45° 朝向。NORMAL 是冷灰藍、圓角菱方 bow、單一掛孔與兩個大 bit 階差；CATEGORY 是銀灰 key body 加上不等量、低飽和 RGBY injection-molded panels，禁止四等分、十字、pizza wheel、風車或 logo 感；ERA 是乾淨低飽和 brass 的 open round bow、巨大負空間與簡潔 warded bit，禁止做舊、鏽、綠銅與金幣感；UNIVERSAL 是香檳金／深靛藍的精密圓角八邊形 head、整合式掛孔與最多 3–4 個幾何刻印，working end 反而採材料較少的開放式 passkey bit，禁止皇冠、花瓣、教堂窗與魔法裝飾。
- 四把母圖的 head bounding box 控制在約 `290–315 × 280–310px`，整把視覺長度約 `950–1000px`；不可因特殊用途放大 UNIVERSAL，也不可讓簡潔的 NORMAL 看起來縮小。輸出後必須檢查 128／64／48px 剪影與主色辨識，任何縮小後只剩噪點的細節都要移除。
- AI 生成稿只能作為探索素材；即使背景有真 alpha，只要尺寸、方向、透視、色塊密度或家族語言不合格就刪除，不得放進產品。本輪先前五張不合格生成稿已刪除，正式素材需重新依本 spec 收斂後才可替換目前可回退資產。
- 目前前台暫用的鑰匙資產固定放在 `QMAH.Client/public/assets/catalog/keys/`，並依檔名對應 `normal.png`＝NORMAL、`category.png`＝CATEGORY、`era.png`＝ERA、`universal.png`＝UNIVERSAL；會員資產、圖鑑清單、背包與解鎖確認視窗共用同一個對照，之後更換正式素材時只替換資產或集中對照，不在各頁另指向圖檔。
- 鑰匙造型研究可參考歷史語彙，但不直接仿作博物館藏品或任天堂／寶可夢素材；最終資產必須是清楚、舒服、可縮放且具有 QMAH 自己規則的道具圖示。
- Footer 的隱私權政策與服務條款必須各自連到實際可讀的 `/privacy-policy`、`/terms` 通用頁；沒有 route 的項目不得以 `#` 假裝可用。客服電話／信箱不存在時只提供「聯絡我們」並連到 `https://github.com/MSIT173-03`。
- 登入頁不提供開發測試登入；一般帳號與管理員都走正式登入流程。登入任務優先於品牌展示，表單在第一視線內保持可見；旁側可使用多張真實、可合法部署且有來源標示的故宮院區／院藏影像輪播，清楚說明北部院區（本院）、南部院區（南院）或作品脈絡，不讓單一長卷或大幅裝飾壓縮表單。使用台灣慣用的「高畫質／高解析度」文案，不使用「高清」；輪播可暫停並支援 reduced motion。未設定 Google OAuth 時不顯示不可用的登入按鈕，只以低干擾文字明確指出需由管理員補上 Google Client ID 與 Google Client Secret。
- 登入頁新增的實景素材必須以本地部署副本保存來源與授權資訊；本輪使用北部院區正館與南部院區建築的 Wikimedia Commons 公開授權素材，並保留清院本《清明上河圖》既有故宮開放資料來源，不使用 AI 生圖作為登入主視覺。
- 清院本《清明上河圖》若作為登入頁主視覺，優先採用可部署的高畫質分段影像，讓內容在滿版裁切後仍可閱讀；共用 `ImageMagnifier` 以滑鼠／觸控拖曳觀察局部，輪播以慢速平移、暫停、前後切段組成，不用高頻自動換圖。
- 高畫質滿版影像保留足夠的原始像素，但部署格式優先採現代壓縮格式；本輪清院本分段維持 `3080 × 2036`，改用高品質 WebP，避免手機首屏為了清晰度載入不必要的 JPEG 體積。
- 登入頁的畫卷質感遮罩只放在影像層；標題、段落位置、來源、提示與播放控制必須位於遮罩之上，不用整頁暗化或模糊來換取可讀性。長幅畫卷自動移動只動畫 `transform`，避免逐幀變更 `object-position` 造成不必要的繪製成本。
- 登入頁深淺模式沿用 `data-theme`；切換使用原生 View Transitions API，並以 CSS 光暈作 fallback。切換期間必須鎖住控制項，避免快速連點造成主題狀態競速；動畫需尊重 `prefers-reduced-motion`。
- Mobile 不把 Desktop 雙欄硬縮小：登入頁採「品牌列 → 登入 → 畫卷鑑賞」的主任務順序，畫卷說明、來源與上一段／播放／下一段控制放到登入之後；放大鏡保留但加大觸控鏡頭。其他 Area 依用途採必要的 wrap、stack、scroll 或 responsive grid，不能只靠縮小字體維持桌面排列。
- 登入表單的收合／展開使用與標題同列、至少 48px 的高辨識度 icon button；收合狀態保留至少 44px 的完整「登入」入口，不讓表單消失後沒有回路。兩種狀態共用命名 View Transition 做卡片到入口的空間變形；不支援或 reduced motion 時仍可直接切換，並在轉場後把鍵盤焦點交回對應入口。
- 登入頁的放大鏡必須在首次畫面就可見；使用者抓住鏡面時暫停畫卷自動平移，放開後回復抓取前的播放狀態。鏡面支援滑鼠／觸控拖曳與方向鍵微調，提示文案要直接說明可拖曳查看細節。

## 全站共用視覺語法（以 Game 為校準頁）

- 這一輪不是把五大系統改成同一種版型；保留各頁既有資訊編排與特色，只收斂相同語意的元件規則。Game 頁作為校準基準：清楚的頁面標題、短而明確的說明、單一主要行動、低干擾的次要操作。
- 字體只分三層情境：頁面／章節標題使用現有的 Noto Serif TC（不超過 54px，手機約 34–40px）；正文與表單使用 Noto Sans TC（14–16px，行高 1.55–1.7）；標籤、狀態與技術資料使用 IBM Plex Mono（10–13px，僅在需要短標示時使用）。不以全大寫英文取代繁中資訊，也不讓裝飾字體承擔操作說明。
- 尺度以 4px 為基礎：區塊間距 24–40px、卡片內距 16–28px、欄間距 16–32px、控制項間距 8–12px；頁面容器維持既有最大寬度，不用局部大留白補救層級問題。
- 共用控制項以 44px 作為最低觸控高度；一般輸入／選擇器 44–48px；按鈕內距約 10–14px（左右 14–22px）。Primary 使用深青色實心，Secondary 使用同尺寸淺底／外框，Destructive 使用既有錯誤色；相同語意不再跨 Area 任意換成文字連結、Emoji 或不同色系。
- 卡片、對話框與面板共用 8–14px 圓角範圍；一般卡片使用 1px 邊框與低對比陰影，只有真正浮起的 Dialog／Drawer 使用較明顯陰影。避免同一層級同時出現 0px、24px 與超重投影。
- 色彩優先確保文字對比與層級：正文使用深墨色，次要文字只降低明度不降低到不可讀；主色、輔色與錯誤色各自只承擔固定語意。Active／Selected 不只靠顏色，需搭配底色、邊框、粗細或 `aria-current`／`aria-pressed`。
- 表單欄位必須有可持久辨識的 label；載入、空資料、錯誤與成功狀態保留原本資料語意，不用漂亮文案掩飾尚未實作的後端能力。所有跨頁／共用元件／導航／RWD 的調整，留下簡短、能說明原因的 `ui-integration` 註解。
- 任何後續修改若無法用「一致性、可導航性、可用性、RWD 或無障礙」說明，應先停下來回看本文件與 active goal，不以個人審美擴大範圍。

## 設計與互動規則

- Global Navigation → Area Navigation → Page Content 的層級要清楚；目前 Area 要有可辨識但不誇張的 active state。
- 五個前台 Area 的正式顯示名稱固定為四字：`會員中心`、`圖鑑鑰匙`、`遊戲大廳`、`社群廣場`、`購物商城`；Desktop、Mobile 與相關入口不得各自改寫成不同長度或同義詞。
- Desktop 使用完整導覽；Mobile 使用可正常開關、點 route 後自動收起、可 Escape 關閉且不溢出 viewport 的 compact navigation / drawer。
- 同一語意的 Primary、Secondary、Destructive、Back / Navigation action 使用一致的視覺層級與 touch target；原生 button / link 優先於 div click。
- Detail、深層會員頁、商城商品流程、社群貼文／活動、圖鑑相關頁與遊戲結束／離開流程，都要能回到合理的上層或主要導覽，不要求以 Browser Back 維持可用。
- Page title、section title、body、metadata、status / helper text 的層級要一致；相同角色不因 Area 改變而忽大忽小。
- Shared container、horizontal padding、section spacing、card / form / table 基本語法要收斂；頁面原本合理的 composition 不重排。
- 優先修正真正影響使用的 overflow、固定寬度、被 header / drawer 遮住、CTA 消失、modal 超出 viewport、表單或表格無法操作等問題。
- Icon-only control 必須有 accessible name；保留 keyboard focus、原生語意、合理的 modal / drawer 操作與 `prefers-reduced-motion` 支援。
- Loading、empty、error、success、disabled 狀態要可理解且不暴露 debug stack；不把尚未實作的功能偽裝成空資料。
- Game 每個 state 依序突出 Current State / Objective → Current Content → Primary Action → Supporting Information；不把所有內容做成等權重 card，也不讓 enum、API terminology 或 placeholder 文案直接暴露給玩家。
- Game 的 color role 要有限且可預期：accent、primary、success、warning、error、selected、disabled、neutral surface 與 text hierarchy 不互相混用；成功、錯誤、選取與玩家狀態不能只靠顏色辨識。
- Game 的 micro-interaction 只用來說明 hover、選取、送出、揭曉與狀態轉換，維持短、穩定、不阻擋操作並尊重 reduced motion；Waiting 要表達正在等誰或等什麼，Result 要表達結果、重要資訊、獎勵與下一個既有出口。
- Game 的互動動畫要低成本、短促且服務於語意；房間預設不選取，選取後才顯示明確但不喧賓奪主的狀態。長篇說明、橫幅與 supporting context 應可切換或收合，不可在玩家要找房間時直接佔掉主要瀏覽面積。
- Game 大廳未選房時不保留空的桌面詳情欄；清單使用受控的可讀寬度，選房後以獨立詳情對話框呈現，桌面與行動版都不因選房而改變清單的欄位結構。
- Mobile 不是單純縮小 Desktop；優先保留 Current Objective、Current Content、Primary Action，Supporting Context 可下移或收合，但不得讓主要操作消失或被浮層遮住。
- Responsive review 至少以 320、390、768、1024、1440 CSS px 檢查；優先採 intrinsic layout、`minmax()`、`clamp()`、可換行 toolbar 與受控的 overflow，不用一串裝置專用 breakpoint 修補單一畫面。可點擊控制至少保留約 44px 觸控範圍，動畫需支援 `prefers-reduced-motion`。

## 驗收條件

- 從 global navigation 可在一兩次操作內抵達 User、Catalog、Game、Social、Store。
- 代表流程可自然往返：會員中心 ↔ 圖鑑／鑰匙、商城首頁 → 商品列表 → 商品詳情 → 返回商城、社群列表 → 詳情 → 返回列表、圖鑑 → 既有相關頁 → 回圖鑑、遊戲入口 → 既有房間／結果／離開流程。
- Desktop、Tablet、Mobile 均確認 header、drawer、active state、content offset、overflow、modal、form 與主要 CTA。
- Frontend production build 與既有 tests 通過；不因 UI 整合破壞既有 route 或功能。
- 管理員能從 Game 子導覽進入正式遊戲檢查中心；未登入或非 Admin 直接造訪 `/game/test`，以及非 Admin 造訪 `?test=1` 房間，都必須被導回合理入口且不會啟動隔離流程。
- 完成後以完整 diff 回看每一個較大的 UI change，移除只是個人審美偏好的改動與暫存產物。
- 最終 review 必須確認所有本輪改動都有對應的清楚註解，且 active goal 仍引用這份根目錄原則文件；不可只以 build 成功宣稱完成。

## 實作依據

本原則以使用者的前台整合 brief、目前 `main` checkout 的實際程式，以及 `impeccable` 的 polish / craft floor、`responsive-design` 與 `web-design-guidelines` 檢查規則為依據。目前已安裝並採用使用者層最新版 Impeccable v4.3.1；`impeccable` 用來把既有頁面提升到 pro max 完成度，除 Game 這個明確例外外，不授權把本輪變成全面 redesign。Angular 核心套件固定在 21.2.23、CLI／Build 固定在 21.2.24 的 Angular 21 相容線，不因工具更新而漂移。

本輪鑰匙造型研究參考： [British Museum 的羅馬／中世紀鑰匙](https://www.britishmuseum.org/collection/object/H_1810-0210-12-j)、[大都會博物館的羅馬鑰匙環](https://www.metmuseum.org/art/collection/search/558424)、[British Museum 的盎格魯薩克遜鑰匙](https://www.britishmuseum.org/collection/object/H_1856-0701-1087)、[British Museum 的中世紀朝聖徽章鑰匙](https://www.britishmuseum.org/collection/object/H_1913-0619-60)、[British Museum 的 18 世紀儀式性鑰匙](https://www.britishmuseum.org/collection/object/H_1888-1201-32)，以及 [Lucide 官方圖示系統](https://lucide.dev/)。這些資料只用來理解造型語彙與時代差異，不作為直接複製素材的授權依據。
