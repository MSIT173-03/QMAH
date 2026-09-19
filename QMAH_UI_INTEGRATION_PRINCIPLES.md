# QMAH 前台 UI 整合目標與原則

## 目標

以目前已整合完成的遊戲前台作為視覺與互動基準，讓 User、Catalog、Game、Social、Store 明顯屬於同一個 QMAH 產品。第一輪維持 User、Catalog、Social、Store 原有的版面大方向與資訊架構；Game 是本輪視覺基準，也是可較大幅強化的例外，但仍保留既有遊戲流程、Route、API 與商業邏輯。

本輪工作的重點是共用 App Shell、跨 Area 導覽、Detail 返回路徑、視覺語法收斂與 Desktop / Tablet / Mobile 可用性，不是重新設計產品或補做新功能。

Game 的品質門檻同時包含 Usability 與 Modern Visual Quality：玩家第一次進入時要知道目前狀態、下一步目標、主要內容與主要操作；畫面也要具備可正式 Demo 的層級、節奏與完成度。可用性不能把 Game 做成灰色後台，視覺精緻也不能用漸層、玻璃效果或動畫掩蓋操作問題。

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
- 不修改 API business logic、economy / order / reward logic、auth architecture、database schema 或既有 canonical contract。
- 不以大型 design system、元件抽象或依賴套件取代目前可用的局部修正。
- Admin 可以保留自己的管理導覽與版面；前台 global navigation 不應破壞既有 Admin flow。
- 每一項 UI、Route、Shared Layer、Layout ownership、Navigation behavior 或 RWD behavior 改動，都要在程式碼附近留下清楚易懂的繁中 `ui-integration` 原因註解，讓長時間任務後仍能看懂「為什麼改」與「刻意保留什麼」。TypeScript / HTML 使用 `// ui-integration:`，SCSS / CSS 使用 `/* ui-integration: ... */`；純單點 spacing / typography / class 微調可用區塊註解，不必逐行污染。
- 前台樣式統一使用 SCSS：`src/styles.scss` 是全域入口，元件與頁面使用同名 `.scss`；不新增純 CSS／inline `styles` 雙軌。只有在既有樣式確實被本輪觸碰時才做最小轉檔，避免為了格式統一製造無關 diff。
- 前台功能圖示統一使用固定版本的 `@lucide/angular`，目前鎖定 `1.47.0`；不得因為「安裝最新」而讓 Angular 21 專案的相容性漂移。功能圖示不得再以 emoji、`ICON`、`IMG` 或手工混搭的 icon library 充當正式 UI；必要時透過 `QmahIconComponent` 保持語意名稱、尺寸與筆畫一致。
- 圖鑑鑰匙是例外的內容型道具，不使用通用功能圖示取代。每一種鑰匙必須使用相同 `viewBox="0 0 256 256"`、透明背景、相同尺寸比例、相同朝向與相同主體輪廓，只以少量、低彩度的內圈／徽記區分用途；不得把不同角度或不同畫風的圖片硬排在一起，也不得使用過度寫實、深色、厚重或高細節的素材。
- 鑰匙造型採「歷史語彙的現代化縮寫」：羅馬與早期實用鑰匙提供簡潔的桿身、環形匙 bow 與工具感；中世紀與儀式性鑰匙提供有限度的象徵性 bow；明代器物的刻紋／鎏金案例提供克制的局部裝飾參考。最後以清楚、舒服、可縮放的平面 SVG 呈現，不直接仿作博物館藏品或任天堂／寶可夢素材。
- AI 生成稿只能作為探索素材；若無法同時符合透明背景、同尺寸同朝向、低干擾與現代一致性，就不納入產品。最終交付的鑰匙資產要能在小尺寸格線、確認視窗與列表中維持同一套視覺語法。
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
