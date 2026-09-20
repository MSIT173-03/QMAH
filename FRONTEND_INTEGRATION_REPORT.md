# 前台整合簡短報告

日期：2026-09-20

## 結論

清明鑑定屋前台的 User、Catalog、Game、Social、Store 五個系統已完成本輪共用 UI 語言收斂，可作為後續功能開發與展示的基線。這次保留原有資訊架構、Route、API 契約與商業邏輯，主要整理共用 App Shell、頁尾、主題狀態、字體層級、色彩語意、間距、圓角、陰影、表單與控制項細節。

這是前台整合完成，不是所有需要後端服務的流程都已完成端對端驗證。會員與管理員相關流程仍須在 API、資料庫與本機登入環境可用時再做完整瀏覽器確認。

## 本輪完成

- App Shell、全站導覽、行動版導覽、active state 與共用 Footer 的樣式基線收斂。
- User、Catalog、Game、Social、Store 接回同一組 typography、色彩角色、spacing、radius、shadow 與 control tokens。
- 保留各 Area 原本的版面用途與操作流程；Game 作為視覺密度與互動完成度的參考，不作為其他頁面的固定模板。
- 保留既有深淺主題狀態與前台頁面差異，不在本輪擴張成全站 redesign。
- Visual Studio 新增清楚的複合啟動選項 `QMAH 全站（API＋前台＋管理後台）`，可同時啟動 API、Angular 使用者前台與 Razor 管理後台。

## 驗證摘要

- Angular production build：通過。
- 既有前端測試：45 個 test files、63 個 tests 通過。
- 代表性樣式檢查：共用入口、App Shell、首頁、會員中心、登入後重設密碼與管理頁未發現需另行處理的 detector 問題。
- 桌面瀏覽器 smoke check：首頁、遊戲大廳、商城首頁可正常呈現共用導覽、內容與頁尾。
- 會員與管理後台的登入後流程：本輪未宣稱完成端對端確認；驗證當下 API 未啟動，無法以此取代後端可用時的流程測試。

## 啟動方式

使用 Visual Studio 開啟 `QMAH.sln`，在啟動設定選擇 `QMAH 全站（API＋前台＋管理後台）`。啟動後：

- API：`https://localhost:7249`
- Angular 使用者前台：`http://localhost:4200/`
- Razor 管理後台：`https://localhost:7039`

若只需要部分服務，`QMAH.slnLaunch` 仍保留 API 單獨啟動與 API＋Angular 前台的設定。

## 刻意保留

本輪沒有處理全站品牌色重做、商城首頁內容補齊、ImageMagnifier、Social 語意細修、完整會員／管理流程驗證，以及需要重新規劃資訊架構的 polish 項目。這些項目應在有明確需求與可驗證範圍時再個別處理。
