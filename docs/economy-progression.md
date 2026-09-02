# 經濟與進程基準

本文件記錄目前開發階段採用的經濟與進程基準。文中的點數獎勵、鑰匙兌換比例、折價券門檻與其他數值都屬於暫時設定，仍待 Angular 前端使用者前台完成後依實際遊玩時間、取得速度、圖鑑規模與商城價格進一步討論。系統因此刻意將主要平衡參數放在管理後台可調整的設定中，前端不應寫死這些數值。

## 鑑定點數與鑰匙

使用者看到的 Point 名稱統一為「鑑定點數」。程式與資料庫仍沿用 `PointBalance`、`PointTransaction` 等技術名稱。點數可以由遊戲、鑰匙回收、活動或管理員調整取得，也可以兌換常駐折價券；每次增減都會寫入點數流水。

圖鑑解鎖使用四種鑰匙：

| 代碼 | 用途 | 候選由誰決定 |
| --- | --- | --- |
| `NORMAL` | 從所有啟用且尚未解鎖的文物隨機解鎖一件 | 伺服器 |
| `CATEGORY` | 從指定分類中尚未解鎖的文物隨機解鎖一件 | 伺服器 |
| `ERA` | 從指定年代中尚未解鎖的文物隨機解鎖一件 | 伺服器 |
| `UNIVERSAL` | 從任一尚未解鎖文物中由會員選擇一件 | 會員選擇，伺服器驗證 |

只有 `UNIVERSAL` 允許使用者前台送出 `artifactId`（文物識別碼）。其他三種鑰匙的候選清單與隨機結果都由伺服器產生。若目前沒有符合條件的文物，系統不扣鑰匙，也不建立 `ArtifactUnlock`（文物解鎖紀錄）。

圖鑑完成率、分類完成率、年代完成率與鑰匙的可解鎖數量，都以目前 `Active`（啟用中）的文物即時計算。增加文物、分類或年代資料時，不需要修改程式中的總數。

## 每日登入與共用進程

會員使用者前台在登入完成後明確呼叫 `POST /api/v1/me/daily-activity/login`，`DailyActivityService` 會在 `common.DailyMemberActivities` 保存當天的 `LOGIN` 歷史事實。同一會員同一天再次呼叫只增加 `OccurrenceCount`，不會建立重複日期資料，也不會重複取得同一項登入成就。管理後台登入不會呼叫這個端點。

`GET /api/v1/me/daily-activity` 每次都從每日登入歷史重新計算最後登入日期、累積登入天數、目前與最高連續登入天數、今日是否已登入，以及 `LifetimeLoginRate`（會員建立日至目前日期的登入天數比例）。系統不另存逐月登入率或其他統計快照；營運中心的選定期間登入率則以期間內不重複登入會員數除以期末會員數即時計算。每日歷史只保存每位會員每天一列，避免同日重複登入造成無限制成長，並保留任意月份重新計算的能力。

每日登入成就屬於成就與稱號進程，只建立 `UserAchievement` 取得紀錄，不發鑑定點數、鑰匙或折價券。成就的條件與門檻仍由啟用中的 `Achievement` 資料列決定；未來若加入明確簽到，可在同一張共用表用 `CHECK_IN` 區分來源。

## 多人主遊戲獎勵

多人主遊戲完成並通過結算後，系統依玩家在各回合取得的票數比例、勝出回合比例與目前設定計算獎勵。票數不是一票換一點，因為每場玩家人數、回合數與有效票數可能不同。

目前的平衡基準是完成一場取得約 8 到 20 點鑑定點數，完成遊戲取得 1 把一般鑰匙，表現達到設定門檻時再增加最多 1 把一般鑰匙。基準值實際存放在 `GameEconomySettings`，可由後台調整：

- 點數最低值、最高值與基礎值
- 票數比例上限加成與勝場比例上限加成
- 完成獎勵的一般鑰匙數量
- 達到優良表現門檻後的額外一般鑰匙數量
- 優良表現門檻

同一場遊戲只能成功領取一次獎勵。點數與鑰匙會在同一個交易邊界內更新，並分別留下 `PointTransaction` 與 `KeyTransaction`。

## Mini Game 與累積鑰匙進度

目前預留四種 Mini Game（小遊戲）模式：

- `DETAIL_LOCATOR`：細節追蹤
- `ARTIFACT_PUZZLE`：館藏拼圖
- `MEMORY_MATCH`：館藏翻牌
- `STRIP_RESTORE`：長卷復位

這四種模式共用 `GameModeDefinitions`、`MiniGameAttempts` 與同一套開始、完成、評分、獎勵流程。遊戲素材由啟用中的 Artifact Image（文物圖片）產生，伺服器在開始時決定模式、文物或文物池、難度、Seed（結果重現用的隨機種子）與設定。

完成時使用者前台只送原始結果，例如分數與必要的結果 JSON。伺服器重新驗證分數，依資料庫中的級距計算 `NormalizedScore`（標準化分數）、Grade（評級）、點數獎勵與鑰匙進度獎勵，使用者前台不可以自行送 `S` 或任意點數取代計算結果。

目前的級距獎勵基準如下：

| 評級 | 鑑定點數 | 鑰匙進度 |
| --- | ---: | ---: |
| `FAIL`、`C` | 0 | 0 |
| `B` | 1 | 3 |
| `A` | 2 | 6 |
| `S` | 3 | 10 |

鑰匙進度是累積制，不是每次直接發一把鑰匙。每次有經濟獎勵的 Mini Game 完成後，系統先把進度加到會員的進度條；當累積進度達到 `GameEconomySettings.KeyProgressToNormalKey` 設定的門檻，就把每滿一個門檻轉成一把一般鑰匙，剩餘進度保留到下一次。轉換同時留下負的進度流水與正的一般鑰匙流水。

例如門檻為 100，會員原本有 94 點進度，本次拿到 10 點進度，總數為 104，系統會轉成 1 把一般鑰匙，進度條留下 4。點數獎勵則照該次評級另外增加，兩者是不同的獎勵欄位，不會把鑰匙進度誤當成鑑定點數。

每天前 5 次完成的 Mini Game 具有經濟獎勵。超過當日額度的 Attempt（一次遊戲嘗試）仍會保存分數、評級、個人最佳紀錄與成就計算所需資料，但點數與鑰匙進度獎勵為 0。每日額度與進度門檻都由後台設定。

## 鑰匙兌換與回收

鑰匙兌換規則存放在 `KeyExchangeRules`，使用者前台透過 API 取得目前啟用規則，不應把比例寫在 Angular 程式裡。現階段的基準是：

| 消耗 | 取得 |
| --- | --- |
| 2 把 `NORMAL` | 1 把 `CATEGORY` |
| 3 把 `NORMAL` | 1 把 `ERA` |
| 4 把 `NORMAL` | 1 把 `UNIVERSAL` |

會員兌換前，系統會重新確認目標鑰匙仍有可解鎖文物。沒有候選文物時不能兌換；來源鑰匙不足時也不會只完成一半。來源與目標鑰匙各留一筆交易紀錄。

鑰匙回收只在該會員使用這把鑰匙已經找不到任何可解鎖文物時成立。回收數量仍受餘額限制，不能把鑰匙當成自由出售的資產。每種鑰匙目前的回收點數基準為：`NORMAL` 2 點、`CATEGORY` 3 點、`ERA` 5 點、`UNIVERSAL` 6 點；實際值存放在 `KeyDefinitions.RecyclePointValue`，由後台調整。

管理員調整回收值時，系統應維持兌換與回收的經濟順序，避免高階鑰匙經兌換後立刻回收而產生無成本套利。資料庫與後台驗證也會限制負數、無效比例與無法解鎖目標的規則。

## 折價券

`CouponDefinition` 描述券的規則，`UserCoupon` 描述會員實際取得的一張券。折扣方式與取得方式是兩個欄位：

- `DiscountType`：`FIXED`（固定折抵金額）或 `PERCENT`（百分比折扣）
- `AcquisitionType`：`POINT_EXCHANGE`（鑑定點數兌換）或 `ADMIN_GRANT`（管理員發放）

常駐點數兌換券的成本、折扣值、最低消費、有效天數、啟用狀態與使用期間都放在 `CouponDefinitions`。目前可用的平衡參考包含 50 點換 20 元、100 點換 50 元、250 點換 150 元、500 點換 350 元與 750 點換 600 元，最低消費分別為 200、500、1000、2000、3000 元。這些只是起始資料，使用者前台應以 API 回傳的兌換選項為準。

管理員發放券可以不設定 `PointCost`，由後台指定券的名稱、折扣方式、折扣值、最低消費、有效天數與發放對象。每一次發放都建立新的 `UserCoupon`，所以同一位會員可以同時持有同一種券的 `USED`、`EXPIRED` 與 `AVAILABLE` 紀錄。

每張券的 `ExpiresAt` 從該次 `IssuedAt` 加上規則的 `ValidityDays` 計算，不使用 Coupon Definition 的建立時間。券過期後由 `AVAILABLE` 轉為 `EXPIRED`，查詢可用券時排除過期資料，但券列與歷史紀錄保留在資料庫。

同一個 `CouponDefinition` 可以對同一會員發放多次，每次都是獨立的 `UserCoupon`。`USED`、`EXPIRED`、`AVAILABLE` 與 `REVOKED` 都是券的生命週期狀態，歷史狀態不透過一般管理操作刪除。

## 活動與私人房間加碼

活動報名與私人房間邀請可以附帶點數或鑰匙加碼。官方活動由管理員設定 `UNLIMITED` 規則，在有效期間內對符合條件的參與者發放，不扣除管理員個人背包；會員發起的活動或私人房間使用 `LIMITED` 總預算，只有實際發出時才從發起人的點數與鑰匙餘額扣除。

會員的預算或背包在某次發放前已用完時，參與者仍可完成報名或加入，只是該項加碼為 0，不會強制扣款或產生負數。每次實際發放會在參與資料保存使用的規則與數量，並留下 `COMMUNITY_REWARD` 點數／鑰匙流水，避免同一場參與重複領取。

## 成就與稱號

成就用於記錄圖鑑、分類、年代、多人遊戲、Mini Game、社群與活動進程。完成比例依目前啟用資料動態計算，成就本身不回發點數、鑰匙或折價券，避免 Prestige（展示成就進程）反過來形成經濟循環。

成就名稱與取得後可配戴的稱號分開管理。會員最多配戴一個稱號，也可以不配戴；`EquippedTitles` 只能指向該會員已取得的 `UserAchievement`。展示成就徽章與目前配戴稱號是兩種不同狀態，使用者前台應分別讀取。

## 管理員調整與批次活動

管理員不能直接把 `PointBalance` 或 `UserKeyBalance` 改成某個總數。逐人調整時必須填寫原因，系統以增加或扣除的數量建立交易流水，再更新餘額；點數與鑰匙都不允許變成負數。優惠券同樣使用 Grant（發放）與 Revoke（撤銷），撤銷改變狀態並留下管理員、時間與原因，不刪除原資料。

各背包仍提供逐人調整。需要活動補發、客服補償或其他特殊作業時，營運中心的「資產活動」提供獨立批次入口。批次可以依會員關鍵字、角色、會員狀態、建立日期與點數範圍篩選對象，先預覽符合人數與樣本，再確認執行。批次主檔保存篩選條件、原因、管理員、目標數量與處理結果；每位會員的點數交易或優惠券紀錄再回指批次。

營運中心會把日常資產流水和批次活動分開統計。日常流水用於對帳，批次統計用於回答某次活動或特殊原因影響了多少會員、增加或扣除了多少資產。

## 稽核紀錄的範圍

本專題只保留對營運有用的管理異動。具權限的管理後台非 GET 操作會在 `admin.AuditLogs` 留下操作者、管理區域、Controller（處理管理請求的程式類別）、Action（執行的管理操作）、HTTP 方法、路徑、結果狀態與必要的目標識別碼。讀取頁面、一般 API 輪詢與使用者前台每次查詢不寫入這張表，request body（請求本文）、密碼、Cookie（瀏覽器保存的小型資料）與 token（驗證用的暫時字串）也不保存。

資產的詳細歷史不依賴 `AuditLogs`：點數看 `PointTransactions`，鑰匙看 `KeyTransactions` 與 `KeyProgressTransactions`，優惠券看 `UserCoupon` 的生命週期，批量活動看 `EconomyAdjustmentBatches`。查詢時先用會員、區域、日期與結果狀態縮小 `AuditLogs`，再依流水或批次主檔查看實際數量。開發環境若需要反覆測試，可清理本機稽核資料；正式環境的保留期限則由部署環境另行設定，不在網站請求中自動刪除歷史。

## 使用者前台要讀取的 API

使用者前台不需要知道獎勵公式，只要依 API（應用程式介面）回應呈現結果：

- `GET /api/v1/me/economy`：鑑定點數、鑰匙餘額、可解鎖數、鑰匙進度與兌換規則
- `GET /api/v1/me/daily-activity`：依歷史資料取得每日登入日期、累積天數、目前／最高連續天數、登入率與今日登入狀態
- `POST /api/v1/me/daily-activity/login`：由會員使用者前台明確記錄一次登入活動；同日重複呼叫不增加登入天數
- `POST /api/v1/me/keys/{keyCode}/unlock`：使用鑰匙解鎖文物，只有 `UNIVERSAL` 送 `artifactId`
- `GET /api/v1/me/keys/exchange-rules`、`POST /api/v1/me/keys/exchange`：查詢與執行鑰匙兌換
- `POST /api/v1/me/keys/{keyCode}/recycle`：回收已無可解鎖文物的鑰匙
- `GET /api/v1/me/coupons/exchange-options`、`POST /api/v1/me/coupons/redeem`：查詢與兌換點數券
- `GET /api/v1/me/coupons`：查詢會員券與有效期限
- `GET /api/v1/me/achievements`：查詢已取得的成就與展示資料
- `GET /api/v1/me/title`、`PUT /api/v1/me/title`：查詢與切換目前配戴稱號
- `GET /api/v1/game/modes`、`POST /api/v1/game/attempts`、`POST /api/v1/game/attempts/{id}/complete`：取得 Mini Game 模式、開始與完成一次遊戲
- `POST /api/v1/game/rooms/{id}/reward`：領取多人主遊戲結算獎勵
- `GET /api/v1/social/events/{id}/reward-policy`、`PUT /api/v1/social/events/{id}/reward-policy`：查詢或設定活動加碼規則
- `GET /api/v1/game/invitations`、`POST /api/v1/game/rooms/{id}/invitations`、`POST /api/v1/game/invitations/{id}/response`：查詢、建立與回應私人房間邀請

寫入 API 的錯誤回應使用 `ProblemDetails`（標準錯誤回應格式）或 `ValidationProblemDetails`（欄位驗證錯誤格式）。使用者前台需要處理登入失效、權限不足、資產不足、沒有候選文物、規則衝突與重複領取等情況。

## 後台可調整的主要數值

| 設定 | 儲存位置 |
| --- | --- |
| 主遊戲點數範圍、票數／勝場加成、一般鑰匙獎勵 | `GameEconomySettings` |
| Mini Game 評級門檻與各級點數／鑰匙進度 | `GameModeDefinitions` |
| Mini Game 每日經濟獎勵次數與進度轉換門檻 | `GameEconomySettings` |
| 鑰匙兌換比例與啟用狀態 | `KeyExchangeRules` |
| 各種鑰匙回收點數 | `KeyDefinitions.RecyclePointValue` |
| 點數券成本、折扣、最低消費、有效天數與期間 | `CouponDefinitions` |

使用者前台只讀取 API 回應，不複製上述設定值。當文物數量、分類數量或年代數量增加時，圖鑑與獎勵候選範圍從資料庫即時計算，程式不依賴固定總數。
