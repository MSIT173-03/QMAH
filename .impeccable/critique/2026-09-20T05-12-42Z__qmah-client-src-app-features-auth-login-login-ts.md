---
target: QMAH.Client/src/app/features/auth/login/login.ts
total_score: 32
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
target_identity: "file:C:\\專題整合\\QMAH-develop\\QMAH.Client\\src\\app\\features\\auth\\login\\login.ts"
target_fingerprint: "sha256:c5c9bbb9c30750a27604bb3b047fc0c6db1ca535e13602198005beebffd02e51"
target_path: "C:\\專題整合\\QMAH-develop\\QMAH.Client\\src\\app\\features\\auth\\login\\login.ts"
timestamp: 2026-09-20T05-12-42Z
slug: qmah-client-src-app-features-auth-login-login-ts
---
⚠️ DEGRADED: single-context (本工作階段未提供 multi_agent_v1__spawn_agent；以單一上下文完成設計審視與瀏覽器證據交叉檢查)

# 清明鑑定屋登入／清明上河圖鑑賞器設計 Audit

## Design Health Score

| # | Nielsen heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | 分段計數、播放／暫停、登入 loading 與錯誤狀態清楚；主題動畫狀態已補上固定解除鎖定上限。 |
| 2 | Match System / Real World | 4/4 | 清院本、畫卷分段、慢速移動、拖曳放大鏡與台灣繁中用語互相支援。 |
| 3 | User Control and Freedom | 4/4 | 可暫停、前後切段、收合登入、鍵盤控制與深淺切換；收合後仍保留同位置登入入口。 |
| 4 | Consistency and Standards | 3/4 | Lucide 圖示、44px 控制與表單語意一致；登入頁仍是獨立的全螢幕體驗，和站內一般卡片語言略有距離。 |
| 5 | Error Prevention | 3/4 | 表單驗證、safe returnUrl、OAuth 未設定不顯示假按鈕；密碼欄仍沒有顯示／隱藏切換。 |
| 6 | Recognition Rather Than Recall | 3/4 | 控制項有 aria label、title 與文字計數；放大鏡仍需依賴小型提示才能理解。 |
| 7 | Flexibility and Efficiency | 4/4 | 滑鼠／觸控拖曳、左右鍵、空白鍵、手機配置與 reduced motion 都有替代路徑。 |
| 8 | Aesthetic and Minimalist Design | 3/4 | 真實高畫質畫卷建立品牌記憶點；登入卡仍略像通用登入模板，來源與控制文字在畫面上偏輕。 |
| 9 | Error Recovery | 3/4 | 401、503、欄位錯誤都有自然文案；實際登入成功／失敗流程仍受本機 API 未啟動限制。 |
| 10 | Help and Documentation | 2/4 | 有拖曳提示、來源連結與公開版本連結，但沒有更完整的鑑賞操作說明。 |
| **Total** |  | **32/40** | **Good：基礎已穩定，仍有幾個值得打磨的設計細節。** |

## Design Specificity Verdict

這不是可套到任何產品的普通 landing page：清院本《清明上河圖》的分段慢移、拖曳放大鏡、故宮資料脈絡與收藏型登入動線已經形成清明鑑定屋自己的入口體驗。最大的未完成感不在功能，而在登入卡仍採常見的白色浮卡語法；若之後要再提升，應加強「鑑賞工具」與「登入」兩者的同一套紙本／院藏語氣，而不是再堆更多裝飾。

## Assessment B：Detector 與瀏覽器證據

- 瀏覽器確認 1440、390、320、768、1024px 代表尺寸沒有水平 overflow；手機採畫卷先行、登入表單下移，收合後保留清楚的「登入」膠囊。
- 實測拖曳放大鏡、前後切段、播放／暫停、收合與重新展開；收合／展開後焦點分別回到 `#login-panel-collapsed` 與 `#email`。
- 實測深淺模式快速連點：第二次點擊不會反轉狀態，且固定 fallback 會在上限時間解除 disabled，避免 View Transition promise 未 settle 造成永久鎖定。
- reduced-motion 下輪播按鈕顯示「繼續自動移動」，自動輪播停用；高畫質影像保持 3080 × 2036，部署改用高品質 WebP。
- Impeccable detector 初次掃描唯一命中的是共用放大鏡的動態 `[src]` 綁定被靜態掃描器誤判為缺少 src；實際分支一定傳入影像，已改成等價的 Angular interpolation。先前首頁的 `padding-left` layout transition 也已改成 transform，避免 layout thrash。
- 瀏覽器 console 仍有 `/api/v1/me` 與 notifications 的 500，原因是本次只啟動前端 dev server、未啟動後端 API；這是驗證環境限制，不是登入頁靜態渲染錯誤。

## What's Working

1. 影像不再是 AI 生圖或近照 placeholder，而是有來源與授權紀錄的清院本分段；WebP 壓縮在不改解析度的前提下顯著降低手機載入成本。
2. Desktop 的卡片靠右、畫卷保留大面積閱讀區；Mobile 不硬縮雙欄，而是先看作品、再進入完整登入表單。
3. 收合狀態不是消失：同一側留下可辨識的登入膠囊，且焦點不會掉回 document body。

## Priority Issues

### [P2] 放大鏡是招牌互動，但首次發現成本仍偏高

**Why it matters:** 桌面使用者看到畫卷時，鏡頭要等游標進入才出現；手機使用者只能依靠右下角小字提示。若沒有主動拖曳，最有特色的鑑賞能力容易被當成普通背景圖。

**Fix:** 保持目前簡潔圖示控制，但在第一次載入的短時間顯示一次更清楚的鏡頭落點／拖曳提示，完成一次拖曳後收起並以 sessionStorage 記住，不要長期增加畫面噪音。

### [P2] 登入卡已乾淨，但仍偏向通用表單模板

**Why it matters:** Logo 重複與品牌標題已移除，但白色浮卡、電子郵件／密碼／主按鈕排列仍可被任何 SaaS 登入頁替換，與故宮畫卷的內容氣質還有一段距離。

**Fix:** 下一輪只做小幅 art direction：使用更像紙張的實心表面與細緻邊界、讓「登入」標題和畫卷標題使用同一套字級節奏，避免新增插畫、徽章或 dashboard 式統計。

### [P2] 作品上的 metadata 與控制仍略輕

**Why it matters:** 來源連結、段落位置與底部控制現在可用，但在畫面細節較繁複的段落會被吃掉；為了修正而再加重整張 overlay 又會回到使用者剛否定的陰暗濾鏡。

**Fix:** 保持現有較亮的影像，只給 metadata／控制 dock 局部的透明底或更清楚的文字層級，不再整張圖加深。

### [P2] 畫卷分段重新整理後不保留觀看位置

**Why it matters:** Casey 在手機上被打斷或重新整理後會回到第 1 段；對詳細鑑賞工具而言，這會削弱「慢慢看」的連續感。

**Fix:** 只在 sessionStorage 保存目前段落與 paused 狀態，不保存帳號資料，也不把未登入使用者的瀏覽痕跡送到後端。

## Persona Red Flags

- **Jordan（第一次使用）**：現在能在畫面上看到「登入」膠囊與拖曳提示；仍可能把放大鏡當作普通 hover 效果，第一次沒有拖曳時不會知道它能觀察細節。
- **Sam（鍵盤／讀屏）**：登入表單欄位、錯誤與主題／收合控制都有語意與焦點；放大鏡位置本身沒有鍵盤調整方式，但核心登入與換段流程可用鍵盤完成。
- **Casey（分心的手機使用者）**：畫卷先行且操作在下方，符合拇指區；WebP 已降低首段負擔，但目前仍未保存段落位置，重新回來會失去觀看脈絡。

## Minor Observations

- 密碼顯示／隱藏不是本輪必要功能，但對手機輸入可降低誤輸入。
- 六段資料使用 `01／06／10／14／18／22` 作為穩定段落索引，來源清楚；未來若增加段數，應保持相同計數語法。
- Google OAuth 未設定的管理員提示符合實際狀態，但仍會佔一小段表單高度；後端設定完成後可自然替換成按鈕。

## Questions to Consider

- 要不要讓放大鏡在第一次進入時自動示範一次，完成後就安靜地退場？
- 登入卡下一輪要不要沿用故宮紙張／題跋的細節語氣，還是維持現在的極簡中性以確保表單任務最快？
