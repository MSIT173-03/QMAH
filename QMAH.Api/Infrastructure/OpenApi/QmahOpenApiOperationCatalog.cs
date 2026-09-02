namespace QMAH.Api.Infrastructure.OpenApi;

/// <summary>
/// 提供每個 API operation 的台灣繁體中文摘要與行為說明
/// </summary>
internal static class QmahOpenApiOperationCatalog
{
    private static readonly IReadOnlyDictionary<string, (string Summary, string Description)> Operations =
        new Dictionary<string, (string Summary, string Description)>(StringComparer.OrdinalIgnoreCase)
        {
            ["Account.GetAntiforgeryToken"] = ("取得防偽請求權杖", "在回應 Cookie（瀏覽器保存的小型資料）寫入前端執行寫入操作所需的 `XSRF-TOKEN-API`，成功回傳 `204 No Content`（成功且沒有回應本文）。response body（回應本文）不包含 token（驗證用的暫時字串）；後續 POST、PUT、DELETE 由同一 session（瀏覽器工作階段）沿用該 Cookie。"),
            ["Account.Login"] = ("登入會員帳號", "驗證 request body（請求本文，送出的 JSON 內容）中的 `Email`、`Password` 與 `RememberMe`，成功建立 Identity Cookie（登入狀態 Cookie）並回傳 `204 No Content`（成功且沒有回應本文）。帳號不存在、帳號狀態不是 `ACTIVE` 或密碼不符時統一回傳 `401`，不揭露失敗欄位；QMAH 資料庫無法連線時回傳 `503`。"),
            ["Account.Logout"] = ("登出會員帳號", "驗證目前 Identity Cookie（登入狀態 Cookie）後清除登入狀態，成功回傳 `204 No Content`（成功且沒有回應本文）。"),
            ["Account.Register"] = ("註冊會員帳號", "以 request body（請求本文，送出的 JSON 內容）中的 `Email`、`Nickname` 與 `Password` 建立會員、Profile（會員資料）及 `User` role（會員角色），成功回傳 `201 Created`（已建立資源）與新會員 `userId`（會員識別碼）。Email 已存在時回傳 `409`，不建立重複帳號。"),
            ["Account.ForgotPassword"] = ("申請密碼重設", "依 request body（請求本文，送出的 JSON 內容）中的 `Email` 產生 password reset token（密碼重設 token，一次性密碼重設字串）並寄送重設指示，成功回傳 `202 Accepted`（已接受後續處理）。無論 Email 是否對應帳號都使用相同回應，避免 Email enumeration（由回應推測帳號是否存在）。"),
            ["Account.ResetPassword"] = ("完成密碼重設", "使用 request body（請求本文，送出的 JSON 內容）中的 `Email`、`Token` 與 `NewPassword` 驗證 password reset token（密碼重設 token，一次性密碼重設字串）並更新密碼，成功回傳 `204 No Content`（成功且沒有回應本文）。token（驗證用的暫時字串）無效、過期或新密碼不符合密碼政策時回傳 `400`。"),

            ["AdminDashboard.GetDashboard"] = ("取得管理儀表板摘要", "需要 `Admin` role（管理員角色）。彙整會員、文物、啟用題庫、社群、活動、遊戲、訂單、已付款營收、訂單狀態與熱門商品，並回傳最近 14 天的每日趨勢。"),
            ["Metadata.GetMetadata"] = ("取得前台選項資料", "回傳文物分類、年代、社群板塊、貼文類型、發布者類型、活動類型、審核狀態、發布狀態與媒體狀態的 code（系統代碼）／Label（畫面顯示文字）對照，供前台表單與篩選器使用。"),

            ["Catalog.GetArtifacts"] = ("查詢文物清單", "以 query string（查詢參數）的 `q` 搜尋文物名稱、故宮編號或原始年代文字，並以 `categoryCode`、`eraCode`、`page` 與 `pageSize` 篩選及分頁。結果只包含 `IsActive` 的文物，回應為 `ApiPage<ArtifactListItemDto>`（標準分頁資料格式）。"),
            ["Catalog.GetArtifact"] = ("取得文物詳情", "以 path parameter（路徑參數）`id` 取得啟用文物的基本資料、來源與授權、主要圖片、縮圖，以及是否已建立題庫與商城商品的關聯。文物不存在或未啟用時回傳 `404`。"),
            ["Catalog.GetCategories"] = ("取得文物分類", "回傳文物分類的 `id`（資源識別碼）、`code`（系統代碼）與中文 `name`（顯示名稱），依名稱排序，供圖鑑篩選器使用。"),
            ["Catalog.GetEras"] = ("取得文物年代", "回傳文物年代桶的 `id`（資源識別碼）、`code`（系統代碼）與中文 `name`（顯示名稱），依年代起始年份及名稱排序，供圖鑑篩選器使用。"),
            ["StoreCatalog.GetProducts"] = ("查詢商品清單", "以 query string（查詢參數）的 `q`、`categoryCode`、`artifactId`、`page` 與 `pageSize` 查詢上架商品。`q` 搜尋商品名稱或 `ExternalRef`（外部商品編號），結果只包含 `IsActive` 的商品，回應為 `ApiPage<ProductListItemDto>`（標準分頁資料格式）。"),
            ["StoreCatalog.GetProduct"] = ("取得商品詳情", "以 path parameter（路徑參數）`id` 取得上架商品的價格、庫存、商品圖片、描述、尺寸、評價摘要與對應文物資料。商品不存在或未上架時回傳 `404`。"),
            ["StoreReviews.GetReviews"] = ("查詢商品評價", "以 path parameter（路徑參數）`productId` 查詢商品的已發布評價，並以 `page` 與 `pageSize` 分頁。回應同時包含平均星等與評價總數；隱藏或刪除的評價不列入統計。"),
            ["StoreReviews.GetMyReview"] = ("取得我的商品評價", "需要登入，依 path parameter（路徑參數）`productId` 取得目前會員對該商品的評價。商品未上架或不存在時回傳 `404`；會員尚未評價時也回傳 `404`。"),
            ["StoreReviews.UpsertMyReview"] = ("新增或修改商品評價", "需要登入，依 path parameter（路徑參數）`productId` 與 request body（請求本文，送出的 JSON 內容）中的 `Rating`、`Content` 建立或更新目前會員的評價。`Rating` 限制為 1 至 5，成功回傳更新後的評價資料。"),
            ["StoreReviews.DeleteMyReview"] = ("刪除我的商品評價", "需要登入，依 path parameter（路徑參數）`productId` 將目前會員的評價標記為刪除，保留既有資料關聯。找不到評價時回傳 `404`；刪除成功回傳 `204 No Content`（成功且沒有回應本文）。"),

            ["Social.GetPosts"] = ("查詢社群貼文", "以 query string（查詢參數）的 `q`、`boardCode`、`postType`、`artifactId`、`page` 與 `pageSize` 查詢已發布貼文。`postType` 僅接受 `POST`、`ANNOUNCEMENT` 或 `EVENT`，結果回應為公開貼文分頁清單。"),
            ["Social.GetPost"] = ("取得社群貼文詳情", "以 path parameter（路徑參數）`id` 取得已發布貼文的全文、公開留言與可用社群圖片。貼文不存在或尚未發布時回傳 `404`；留言與媒體只包含目前可公開內容。"),
            ["Social.GetEvents"] = ("查詢活動", "以 `page` 與 `pageSize` 查詢審核通過且已發布的活動，依活動開始時間排序，並回傳目前報名人數。"),
            ["Social.GetEvent"] = ("取得活動詳情", "以 path parameter（路徑參數）`id` 取得已發布活動的內容、地點、座標、名額、報名截止時間、報名人數與目前登入會員的 `IsRegistered` 狀態。活動不存在或不可見時回傳 `404`。"),
            ["Social.CreateEvent"] = ("建立活動", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `EventType`、活動內容、時間、地點、名額與 `PostContentMode` 建立玩家或官方活動。成功建立活動與對應貼文時回傳 `201 Created`（已建立資源）；時間、座標或內容流程不符合規則時回傳 `400` 或 `409`。"),
            ["Social.RegisterEvent"] = ("報名活動", "需要登入，依 path parameter（路徑參數）`id` 為目前會員建立活動報名紀錄。活動必須已發布且仍在報名期間，並須通過名額與重複報名檢查；成功回傳更新後的活動詳情。"),
            ["Social.CancelEventRegistration"] = ("取消活動報名", "需要登入，依 path parameter（路徑參數）`id` 取消目前會員的活動報名。活動或報名紀錄不存在、活動已開始或狀態不允許取消時回傳相應的 `404` 或 `409`。"),
            ["Social.GetAnnouncements"] = ("查詢公告", "以 `page` 與 `pageSize` 查詢已發布的公告貼文。公告使用 `SocialPosts`（社群貼文資料來源）的 `ANNOUNCEMENT` 貼文類型，回應包含公告摘要與發布資訊。"),
            ["Social.CreatePost"] = ("建立社群貼文", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `PostType`、`BoardCode`、`Title`、`Content`、文物關聯、地點與 `MediaIds` 建立一般貼文或公告貼文。社群圖片必須屬於目前會員且可用，成功回傳 `201 Created`（已建立資源）。"),
            ["Social.CreateComment"] = ("建立貼文留言", "需要登入，依 path parameter（路徑參數）`postId` 與 request body（請求本文，送出的 JSON 內容）中的 `Content`、`ParentCommentId` 新增貼文留言或回覆。目標貼文須已發布，回覆的父留言須屬於同一貼文；成功回傳 `201 Created`（已建立資源）。"),
            ["Social.CreateReport"] = ("檢舉社群內容", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `TargetType`、`TargetId`、`Reason` 與選填的 `Detail` 建立檢舉紀錄。目標須為可檢舉的公開貼文或留言，成功建立待處理檢舉時回傳 `202 Accepted`（已接受後續處理）。"),
            ["SocialMedia.Upload"] = ("上傳社群圖片", "需要登入，使用 `multipart/form-data`（表單檔案上傳格式）傳送必填的 binary（原始檔案內容）`file`（檔案欄位）與選填的 `altText`（圖片替代文字）。伺服器依檔案內容辨識 JPEG、PNG、GIF 或 WebP，單一圖片上限為 8 MB；成功回傳 `201 Created`（已建立資源）與受控媒體 URL（資源網址），超過大小回傳 `413`。"),
            ["SocialMedia.GetContent"] = ("讀取社群圖片", "以 path parameter（路徑參數）`id` 讀取已發布貼文使用中的圖片，或由圖片擁有者預覽尚未關聯的圖片。回應支援 HTTP range request（HTTP 分段讀取請求）；圖片不存在、已刪除或目前呼叫者無可見權限時回傳 `404`。"),
            ["SocialMedia.Delete"] = ("刪除社群圖片", "需要登入，依 path parameter（路徑參數）`id` 將目前會員擁有的社群圖片標記為刪除，保留貼文與稽核關聯。成功回傳 `204 No Content`（成功且沒有回應本文）；圖片不存在或不屬於目前會員時回傳 `404`。"),

            ["Game.GetRooms"] = ("查詢遊戲房間", "以 query string（查詢參數）的 `status`、`page` 與 `pageSize` 查詢公開遊戲房間。`status` 可為 `WAITING`、`PLAYING` 或 `COMPLETED`，未指定時預設查詢 `WAITING` 房間，回應為分頁清單。"),
            ["Game.GetRoom"] = ("取得遊戲房間詳情", "以 path parameter（路徑參數）`id` 取得公開房間，或取得目前會員已參與的私人房間詳情。私人房間只對參與者公開；房間不存在或已取消時回傳 `404`。"),
            ["Game.GetRoomHistory"] = ("取得遊戲房間歷程", "以 path parameter（路徑參數）`id` 取得房間的回合歷程、各回合答案與票數、勝者及整場排行榜。私人房間只對參與者公開；房間不存在或已取消時回傳 `404`。"),
            ["Game.CreateRoom"] = ("建立遊戲房間", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `Visibility`、玩家顯示名稱、回合規則與選填的分類／年代篩選建立房間。私人房間必須提供密碼，公開房間不保存密碼；成功回傳 `201 Created`（已建立資源）與房間詳情。"),
            ["Game.JoinRoom"] = ("加入遊戲房間", "需要登入，依 path parameter（路徑參數）`id` 與 request body（請求本文，送出的 JSON 內容）中的玩家顯示名稱及私人房間密碼加入等待中的房間。已在房間中的會員取得現有房間資料；房間額滿、狀態不符或密碼錯誤時回傳流程錯誤。"),
            ["Game.SubmitAnswer"] = ("送出回合作答", "需要登入，依 path parameter（路徑參數）`id` 與 request body（請求本文，送出的 JSON 內容）中的 `AnswerType`、`Text` 提交目前回答階段的答案。`AnswerType` 必須為遊戲允許值，同一玩家同一回合只能提交一次，成功回傳答案資料。"),
            ["Game.SubmitVote"] = ("送出回合投票", "需要登入，依 path parameter（路徑參數）`id` 與 request body（請求本文，送出的 JSON 內容）中的 `AnswerId`、`Count` 提交目前投票階段的票數。投票目標須屬於同一回合且不可投給自己的答案；成功建立投票時回傳 `202 Accepted`（已接受後續處理）。"),
            ["Game.GetRound"] = ("取得遊戲回合詳情", "需要登入，依 path parameter（路徑參數）`id` 取得回合題目、回答、投票與結算資料。私人房間只允許房間參與者讀取；回合不存在時回傳 `404`，無權查看私人房間時回傳 `403`。"),
            ["GameRoomInvitations.GetReceivedInvitations"] = ("查詢收到的房間邀請", "需要登入，回傳目前會員收到的私人房間邀請，依待處理狀態與建立時間排序。每筆資料包含邀請人、房間、回應狀態與實際發出的加碼結果；單純收到邀請不會先扣除任何資產。"),
            ["GameRoomInvitations.GetSentInvitations"] = ("查詢房間邀請紀錄", "需要登入，只有私人房間發起人可以依 path parameter（路徑參數）`roomId` 查詢該房間送出的邀請與處理結果。待處理、接受、拒絕與取消的邀請都保留在回應中。"),
            ["GameRoomInvitations.CreateInvitation"] = ("邀請會員加入私人房間", "需要登入，只有私人房間發起人可以依 path parameter（路徑參數）`roomId`，搭配 request body（請求本文，送出的 JSON 內容）中的 `InviteeUserId` 與選填 `Message` 建立邀請。邀請不會預扣點數或鑰匙，成功回傳邀請資料。"),
            ["GameRoomInvitations.RespondInvitation"] = ("回應私人房間邀請", "需要登入，依 path parameter（路徑參數）`invitationId` 與 request body（請求本文，送出的 JSON 內容）中的 `Decision` 接受或拒絕邀請。接受時加入等待中的房間，再由伺服器依加碼規則實際發放；會員預算或背包不足時仍可入場，但不會被強制扣除。"),
            ["GameRoomInvitations.CancelInvitation"] = ("取消私人房間邀請", "需要登入，只有邀請發起人可以依 path parameter（路徑參數）`invitationId` 取消尚未回應的邀請。已接受、拒絕或已取消的邀請不能再次變更，歷史資料會保留。"),
            ["GameRoomInvitations.GetRoomRewardPolicy"] = ("查詢私人房間加碼規則", "需要登入，依 path parameter（路徑參數）`roomId` 取得私人房間目前的會員加碼設定、每位參與者額度、總預算、已發放量與剩餘額度。未設定加碼時回傳 `null`。"),
            ["GameRoomInvitations.ConfigureRoomRewardPolicy"] = ("設定私人房間加碼規則", "需要登入，只有私人房間發起人可以依 path parameter（路徑參數）`roomId` 設定每位參與者的點數／鑰匙加碼與總量上限。資產只在邀請被接受且實際發放時扣除；兩種加碼皆為 0 時停用規則。"),
            ["CommunityReward.GetEventRewardPolicy"] = ("查詢活動加碼規則", "依 path parameter（路徑參數）`eventId` 取得活動目前的參與加碼設定、有效期間與已發放量。官方活動由管理員提供，不會從管理員個人點數或鑰匙扣除；沒有設定加碼時回傳 `null`。"),
            ["CommunityReward.ConfigureEventRewardPolicy"] = ("設定活動加碼規則", "需要登入，玩家活動由發起人設定，官方活動由管理員設定。官方活動使用有效期間內的官方供應模式，不扣管理員個人資產；玩家活動則以實際發放量與發起人目前背包為上限。"),

            ["Economy.GetEconomy"] = ("取得會員經濟狀態", "需要登入，回傳目前會員的鑑定點數、鑰匙進度、各類鑰匙餘額、每把鑰匙目前可解鎖的文物數量，以及由資料庫啟用中的鑰匙兌換規則。可解鎖數量依目前啟用文物與會員既有解鎖紀錄即時計算，前端不應自行推算。"),
            ["Economy.GetKeyExchangeRules"] = ("查詢鑰匙兌換規則", "需要登入，回傳目前啟用且目標鑰匙仍有可解鎖文物的兌換規則。每筆資料包含來源鑰匙、來源數量、目標鑰匙、目標數量與目前目標可解鎖數量；兌換比例由後台資料設定。"),
            ["Economy.UnlockArtifact"] = ("使用鑰匙解鎖文物", "需要登入，依 path parameter（路徑參數）`keyCode` 使用一把鑰匙解鎖文物。`NORMAL`、`CATEGORY` 與 `ERA` 由伺服器從符合條件且尚未解鎖的啟用文物中隨機選擇；只有 `UNIVERSAL` 允許在 request body（請求本文，送出的 JSON 內容）指定 `ArtifactId`。沒有候選文物時不扣除鑰匙，也不建立解鎖紀錄。"),
            ["Economy.ExchangeKeys"] = ("執行鑰匙兌換", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `RuleId` 與 `Units`，按照目前啟用的資料庫兌換規則扣除來源鑰匙並增加目標鑰匙。目標鑰匙沒有任何可解鎖文物、來源餘額不足或規則已停用時不會完成部分兌換。"),
            ["Economy.RecycleKey"] = ("回收無用途鑰匙", "需要登入，依 path parameter（路徑參數）`keyCode` 與 request body（請求本文，送出的 JSON 內容）中的 `Amount` 回收鑰匙。只有該會員使用此鑰匙已找不到任何符合範圍且尚未解鎖的啟用文物時才能回收；成功會同時留下鑰匙交易與鑑定點數交易。"),
            ["Economy.GetCouponExchangeOptions"] = ("查詢點數兌換優惠券", "需要登入，回傳目前可由鑑定點數兌換的優惠券定義、點數成本、折扣型態、折扣值、最低消費金額與有效天數。前端應直接使用這份資料顯示選項，不應寫死點數門檻或折扣數字。"),
            ["Economy.RedeemCoupon"] = ("使用點數兌換優惠券", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `CouponDefinitionId`，在同一交易中檢查優惠券定義、扣除鑑定點數並建立一張獨立的會員優惠券。優惠券期限從本次 `IssuedAt`（發放時間）起算；點數不足、定義停用或不在兌換期間時不會建立優惠券。"),
            ["Economy.GetEquippedTitle"] = ("取得目前配戴稱號", "需要登入，回傳目前會員正在配戴的成就稱號；尚未選擇稱號時回傳 `null`。配戴狀態與成就取得狀態分開保存。"),
            ["Economy.SetEquippedTitle"] = ("設定目前配戴稱號", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `UserAchievementId` 設定目前配戴稱號；送入 `null` 會清除配戴狀態。只能選擇目前會員已取得且仍存在的成就，成功後同一會員最多保留一個配戴稱號。"),

            ["MiniGame.GetModes"] = ("查詢 Mini Game 模式", "需要登入，回傳目前啟用的四種 Mini Game backend contract（後端契約）：`DETAIL_LOCATOR`、`ARTIFACT_PUZZLE`、`MEMORY_MATCH` 與 `STRIP_RESTORE`。資料包含模式設定、評級門檻與供前端建立遊戲流程所需的設定 JSON。"),
            ["MiniGame.StartAttempt"] = ("開始 Mini Game 回合", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `ModeCode` 建立一次伺服器決定的遊戲嘗試。伺服器選擇啟用文物、文物池、難度、seed（隨機種子）與模式設定，成功回傳 `201 Created`（已建立資源）與前端所需素材。"),
            ["MiniGame.CompleteAttempt"] = ("完成 Mini Game 回合", "需要登入，依 path parameter（路徑參數）`id` 與 request body（請求本文，送出的 JSON 內容）送出原始分數及選填結果資料。伺服器驗證分數、依模式門檻計算標準化分數與等級，再依目前經濟設定給予鑑定點數與鑰匙進度；重複送出同一回合不會重複發放經濟獎勵。"),
            ["MiniGame.RewardMainGame"] = ("結算多人主遊戲獎勵", "需要登入，依 path parameter（路徑參數）`id` 結算目前會員已完成的多人主遊戲。伺服器依回合勝負與投票表現計算鑑定點數及一般鑰匙，並以交易識別避免同一場遊戲重複領取；成功回傳實際獎勵與表現摘要。"),

            ["Me.GetMe"] = ("取得目前會員", "需要登入，依 Identity Cookie（登入狀態 Cookie）的會員識別取得目前會員、Profile（會員資料）、角色、點數與帳號狀態。會員識別由登入狀態決定，回應不接受 request body（請求本文，送出的 JSON 內容）或 query string（查詢參數）指定其他 `UserId`（會員識別碼）。"),
            ["Me.GetDailyActivity"] = ("查詢每日登入進度", "需要登入，依會員的每日登入歷史即時計算最後登入日期、累積登入天數、目前與最高連續登入天數、今日是否已登入及會員存續期間登入率；不讀取預先保存的統計快照。"),
            ["Me.RecordDailyLogin"] = ("記錄會員每日登入", "需要登入，由會員前台在登入完成後明確記錄一次每日登入活動；同一天重複呼叫只更新活動次數，不重複建立日期資料或登入成就。營運後台登入不會自動呼叫此端點。"),
            ["Me.UpdateProfile"] = ("更新會員資料", "需要登入，依 request body（請求本文，送出的 JSON 內容）更新目前會員的 `Nickname`、`Bio`、`Visibility` 與其他可修改 Profile（會員資料）欄位，成功回傳更新後的會員資料。"),
            ["Me.GetOrders"] = ("查詢我的訂單", "需要登入，依 `page` 與 `pageSize` 查詢目前會員的訂單摘要，按照建立時間排序，回應為 `ApiPage<OrderDto>`（標準分頁資料格式）。"),
            ["Me.GetOrder"] = ("取得我的訂單詳情", "需要登入，依 path parameter（路徑參數）`id` 取得目前會員所屬訂單的明細、金額、付款狀態、訂單狀態與配送資料。其他會員的訂單以 `404` 處理。"),
            ["Me.GetCoupons"] = ("查詢我的優惠券", "需要登入，回傳目前會員取得的優惠券、折扣條件、有效期間與使用狀態。可使用狀態會依目前時間與優惠券定義重新判定。"),
            ["Me.GetPosts"] = ("查詢我的貼文", "需要登入，依 `page` 與 `pageSize` 查詢目前會員建立的社群貼文，回應包含貼文摘要、留言數、媒體數與發布狀態。"),
            ["Me.GetAchievements"] = ("查詢我的成就", "需要登入，回傳目前會員已取得且成就定義仍啟用的遊戲與社群成就，包含達成時間、顯示狀態與成就條件。"),
            ["Me.GetCart"] = ("取得我的購物車", "需要登入，回傳目前會員購物車中的商品、數量、目前價格、庫存與小計，依加入購物車時間排序。"),
            ["Me.AddCartItem"] = ("加入購物車商品", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的 `ProductId` 與 `Quantity` 將上架商品加入目前會員購物車。既有商品列會更新數量，並依目前庫存及商品狀態檢查；成功回傳購物車項目。"),
            ["Me.UpdateCartItem"] = ("更新購物車商品", "需要登入，依 path parameter（路徑參數）`productId` 與 request body（請求本文，送出的 JSON 內容）中的 `Quantity` 更新目前會員購物車中的商品數量。送出的內容若包含 `ProductId`，必須與路徑參數一致。"),
            ["Me.RemoveCartItem"] = ("移除購物車商品", "需要登入，依 path parameter（路徑參數）`productId` 移除目前會員購物車中的商品。商品列不存在時仍維持冪等結果，成功回傳 `204 No Content`（成功且沒有回應本文）。"),
            ["Me.GetAddresses"] = ("查詢我的地址", "需要登入，回傳目前會員儲存的收件地址與 `IsDefault` 狀態，預設地址優先排序。"),
            ["Me.CreateAddress"] = ("建立我的地址", "需要登入，依 request body（請求本文，送出的 JSON 內容）建立收件地址；`Latitude` 與 `Longitude` 必須同時提供或同時省略。第一筆地址或指定 `IsDefault` 時會成為預設地址，成功回傳 `201 Created`（已建立資源）。"),
            ["Me.UpdateAddress"] = ("更新我的地址", "需要登入，依 path parameter（路徑參數）`id` 與 request body（請求本文，送出的 JSON 內容）更新目前會員的收件地址。`Latitude` 與 `Longitude` 維持成對規則，地址標籤不可與同一會員的其他地址重複。"),
            ["Me.DeleteAddress"] = ("刪除我的地址", "需要登入，依 path parameter（路徑參數）`id` 刪除目前會員的收件地址。刪除預設地址時會將最早建立的其他地址設為預設地址，成功回傳 `204 No Content`（成功且沒有回應本文）。"),
            ["Me.SetDefaultAddress"] = ("設定預設地址", "需要登入，依 path parameter（路徑參數）`id` 將目前會員的地址設為結帳使用的預設地址，並取消同一會員其他地址的預設狀態。"),
            ["Me.GetNotifications"] = ("查詢我的通知", "需要登入，依 `page` 與 `pageSize` 查詢目前會員的通知，回應包含已讀狀態與已讀時間，按照建立時間排序。"),
            ["Me.MarkNotificationRead"] = ("標記通知為已讀", "需要登入，依 path parameter（路徑參數）`id` 將目前會員的通知標記為已讀並寫入已讀時間。通知不存在或不屬於目前會員時回傳 `404`；成功回傳 `204 No Content`（成功且沒有回應本文）。"),

            ["StoreOrders.CreateOrder"] = ("建立商城訂單", "需要登入，依 request body（請求本文，送出的 JSON 內容）中的商品明細、優惠券、點數與配送資料建立訂單。伺服器會在同一交易中檢查商品上架狀態、庫存、優惠券有效性、點數餘額並扣減庫存；成功回傳 `201 Created`（已建立資源）與訂單資料。"),
            ["StoreOrders.CancelOrder"] = ("取消商城訂單", "需要登入，依 path parameter（路徑參數）`id` 取消目前會員仍處於可取消狀態的訂單，並回補庫存、優惠券與點數。已出貨、已完成或其他不可取消狀態回傳 `409`；成功回傳 `204 No Content`（成功且沒有回應本文）。")
        };

    /// <summary>
    /// 取得指定 Controller 與 action 的文件描述
    /// </summary>
    public static bool TryGet(string controller, string action, out (string Summary, string Description) operation) =>
        Operations.TryGetValue($"{controller}.{action}", out operation);
}
