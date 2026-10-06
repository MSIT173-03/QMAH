# Claude 交接｜QMAH

## 使用者最新要求

- 四個單人遊戲的正式挑戰／玩法展示共八頁，沿用既有單人遊戲玩法說明與評分介紹，勿另寫互相矛盾的版本。
- 操作提示與進度放在盤面上方、靠近視線；不要放左下或盤面底部，也不要重複正式挑戰入口。
- 展示仍顯示點數／鑰匙進度；播放／暫停與倍速分開，預設 1×。
- 通知要接近即時，不能拖累遊戲；保留商城合併進來的修復。
- commit 使用英文 type(scope)，本文與詳述繁體中文、精簡；已授權推送及快轉七個分支。

## 已完成的修改

- `game-training-play-sheet` 統一標題、模式、進度、盤面上方說明與動作位置，展示只留一個正式挑戰入口。
- `game-single-player-copy.ts` 抽出原本選擇玩法卡片的說明，卡片／正式挑戰／展示／評分介紹共用。
- 正式與展示共用 `GameScoringGuideComponent`，在同一個 HUD 顯示；展示原本投影的評分按鈕已移除以免重複。
- 拼圖移除底部初始重複說明；動作回饋移入右側待放置碎片區。翻牌右側文物桌面兩欄，調整書畫及拼圖桌面空間配置。
- Economy／MiniGame 的讀取端點只攔截已取消請求的 OperationCanceledException，回 499；非取消例外仍傳遞。使用者已確認 VS 連續 Continue 兩次後 API 正常，是取消請求被偵錯器停住，並非已證明 API 崩潰。
- 商城保留他人的 EF 評價查詢與已購商品修復；補上商品切換清除舊評價、讀取失敗阻擋誤編輯、舊商品儲存失敗不污染新商品。已快轉合併商城到 `47f59325`（新增折價券排序與返回頂端）。
- 新增獨立 `[Authorize] /hubs/notifications`，沒有使用者自訂訂閱 ID，與遊戲 Hub 分開。全站一條共享通知連線；自動重連補讀、登出／切換會員停止舊連線。登入依 Layout 使用的 `MeApiService.me`，不是另一份 AuthService signal。
- `NotificationPushService` 每 2 秒集中彙總線上會員的已提交通知（數量／未讀／時間戳），變動才推訊號。涵蓋獨立 QMAH.Web 後台寫入。無線上會員不查；獨立 scope、3 秒查詢時限、失敗後 15 秒退避，例外不終止宿主。這是前台推送加伺服器集中偵測，仍有資料庫輪詢，不能宣稱完全事件驅動或保證 2 秒 SLA。
- 鈴鐺移除 20 秒 HTTP 輪詢，合併連續更新、離頁取消請求、暫時失敗保留資料，修正 NG0100 更新問題。通知列表也接推送並清理請求。

## 驗證與限制

- 全套前台最近一次：72 檔案、320 項通過；之後新增通知連線兩項測試與最後共用文案修改，應以最新驗證輸出為準。
- 通知專項 9 項通過，包含共用連線、重連、登出與切換會員、合併讀取、暫時失敗保留資料。
- API 建置零警告／錯誤；`tools/ApiReadChecks` 12 項通過。透過攔截連線驗證取消與 SQL 翻譯，不操作實際 DB。
- 前台正式 build 通過。四個展示曾驗證桌面及 390×844；正式八頁共用結構有元件測試，未送出真實正式遊戲或商城交易。
- 使用者目前執行中的 VS API 是舊 DLL；需重啟 API 與重新整理前台，才能端到端確認新通知 Hub。尚未用真實新通知驗證 API／後台 → 瀏覽器推送，也未保證 VS 偵錯器不再停住。
- 舊鈴鐺只以最新 10 則計算未讀徽章，本次仍保留此行為；若要全站完整未讀總數，須補 API 契約與測試。
- 多 API 實例尚無 SignalR backplane；現有遊戲同樣沒有。不可宣稱已驗證多機部署。

## 接續工作

1. 先確認 Git 狀態與分支同步結果，不重做已完成修改，不覆蓋商城新提交。
2. 重啟 API 後，驗證已登入會員通知、後台通知、已讀同步、斷線重連、登出與切換帳號；確認只有一條通知連線，遊戲 Hub 獨立。
3. 看四種玩法最新桌面展示及正式頁，依使用者回饋調整，沿用共用說明與評分元件；尤其不要再把說明放到畫面底部。
4. 遵守根目錄使用者 AGENTS 偏好：Windows pwsh、最小修改、繁中簡短回報、不可任意吞掉非取消例外或關閉偵錯例外來掩蓋問題。

## 常用驗證

```powershell
npm --prefix QMAH.Client test -- --watch=false
npm --prefix QMAH.Client run build
dotnet build tools/ApiReadChecks/ApiReadChecks.csproj --no-restore -p:UseAppHost=false -o C:/Users/User/AppData/Local/Temp/qmah-api-read-checks
dotnet C:/Users/User/AppData/Local/Temp/qmah-api-read-checks/ApiReadChecks.dll
```

自訂輸出避免 VS 正執行 API 鎖住預設 bin；不要擅自停止使用者專案。`feature/catalog` 位於 `C:/GitHub/QMAH-main-integration`，同步應用 `merge --ff-only main`，不可直接強制改該已取出的分支。
