namespace QMAH.Web.Infrastructure;

/// <summary>
/// 後台專用的顯示文字。資料庫仍保留既有代碼，只有畫面轉成管理者看得懂的名稱。
/// </summary>
public static class AdminDisplayLabels
{
    public static string Status(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ACTIVE" => "啟用",
        "INACTIVE" => "停用",
        "PUBLISHED" => "已發布",
        "HIDDEN" => "已隱藏",
        "DELETED" => "已刪除",
        "PENDING" => "待處理",
        "APPROVED" => "已核准",
        "REJECTED" => "已駁回",
        "RESOLVED" => "已處理",
        "DRAFT" => "草稿",
        "CANCELLED" => "已取消",
        "AVAILABLE" => "可使用",
        "USED" => "已使用",
        "EXPIRED" => "已過期",
        "REVOKED" => "已撤銷",
        "BANNED" => "已停權",
        "DISABLED" => "已停用",
        "WAITING" => "等待中",
        "PLAYING" => "進行中",
        "COMPLETED" => "已完成",
        "SHIPPED" => "已寄送",
        "FULFILLING" => "撿貨中",
        "PAID" => "已付款",
        "PENDING_PAYMENT" => "待付款",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他狀態"
    };

    public static string Board(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "GENERAL" => "綜合交流",
        "CATALOG" => "文物討論",
        "GAME" => "鑑定遊戲",
        "EVENTS" => "活動消息",
        "EVENT" => "活動",
        "DISCOVERY" => "探索發現",
        "REVIEW" => "鑑賞心得",
        "QUESTION" => "問題求助",
        "GUIDE" => "研究筆記",
        _ => string.IsNullOrWhiteSpace(value) ? "未分類" : "其他分類"
    };

    public static string PostType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST" => "一般貼文",
        "ANNOUNCEMENT" => "公告貼文",
        "EVENT" => "活動貼文",
        _ => "其他貼文類型"
    };

    public static string PublisherType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "OFFICIAL" => "官方發布",
        "COMMUNITY" => "社群發布",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他發布者"
    };

    public static string Role(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ADMIN" => "管理員",
        "USER" => "一般會員",
        _ => "其他角色"
    };

    public static string Scope(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "NORMAL" => "一般鑰匙",
        "CATEGORY" => "分類鑰匙",
        "ERA" => "年代鑰匙",
        "UNIVERSAL" => "萬用鑰匙",
        "GLOBAL" => "全域鑰匙",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他範圍"
    };

    public static string ConditionType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST_COUNT" => "發布貼文數",
        "COMMENT_COUNT" => "留言數",
        "ARTIFACT_UNLOCK_COUNT" => "解鎖文物數",
        "CATEGORY_COMPLETE_COUNT" => "完成分類數",
        "ERA_COMPLETE_COUNT" => "完成年代範圍數",
        "CATALOG_COMPLETION_PERCENT" => "圖鑑完成率",
        "GAME_WIN_COUNT" => "遊戲勝場數",
        "GAME_PLAY_COUNT" => "遊戲參與次數",
        "GAME_COMPLETE_COUNT" => "多人遊戲完成場數",
        "GAME_ROUND_WIN_COUNT" => "多人遊戲勝出回合數",
        "MINIGAME_DETAIL_LOCATOR_COUNT" => "細節追蹤完成次數",
        "MINIGAME_ARTIFACT_PUZZLE_COUNT" => "館藏拼圖完成次數",
        "MINIGAME_MEMORY_MATCH_COUNT" => "館藏翻牌完成次數",
        "MINIGAME_STRIP_RESTORE_COUNT" => "長卷復位完成次數",
        "MINIGAME_GRADE_S_COUNT" => "Mini Game S 等級次數",
        "EVENT_JOIN_COUNT" => "參加活動數",
        "EVENT_HOST_COUNT" => "建立活動數",
        "POINT_TOTAL" => "累積點數",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他條件"
    };

    public static string EventType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "OFFICIAL" => "官方活動",
        "PLAYER" => "玩家活動",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他活動類型"
    };

    public static string ReviewStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "PENDING" => "待審核",
        "APPROVED" => "已核准",
        "REJECTED" => "已駁回",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他審核狀態"
    };

    public static string PublishStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "DRAFT" => "草稿",
        "PUBLISHED" => "已發布",
        "CANCELLED" => "已取消",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他發布狀態"
    };

    public static string AnswerType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FACTUAL_REASONING" => "史實推理",
        "PLAUSIBLE_FICTION" => "合理推演",
        "CREATIVE_TALE" => "創意故事",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他作答類型"
    };

    public static string AuditTarget(string? area, string? controller, string? action) =>
        (area?.Trim().ToUpperInvariant(), controller?.Trim(), action?.Trim()) switch
        {
            ("SOCIAL", "SocialEventAdmin", "Create") => "建立社群活動",
            ("SOCIAL", "SocialEventAdmin", "Edit") => "修改社群活動",
            ("SOCIAL", "SocialEventAdmin", "ReviewEvent") => "審核社群活動",
            ("SOCIAL", "SocialEventAdmin", "SetPublishStatus") => "變更活動發布狀態",
            ("SOCIAL", "SocialEventAdmin", "Delete") => "取消社群活動",
            ("SOCIAL", "SocialPostAdmin", "Create") => "建立社群貼文",
            ("SOCIAL", "SocialPostAdmin", "Edit") => "修改社群貼文",
            ("SOCIAL", "SocialPostAdmin", "SetPostStatus") => "變更貼文顯示狀態",
            ("CATALOG", _, _) => "圖鑑管理",
            ("GAME", _, _) => "遊戲管理",
            ("SOCIAL", _, _) => "社群管理",
            ("STORE", _, _) => "商城管理",
            ("USER", _, _) => "會員管理",
            (_, "Operations", "SetMediaStatus") => "變更圖片顯示狀態",
            (_, _, _) => "後台資料管理"
        };

    public static string AuditArea(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ROOT" => "營運中心",
        "CATALOG" => "圖鑑管理",
        "GAME" => "遊戲管理",
        "SOCIAL" => "社群管理",
        "STORE" => "商城管理",
        "USER" => "會員管理",
        _ => "其他管理"
    };

    public static string AuditResult(int statusCode) =>
        statusCode is >= 200 and < 400 ? "完成" : "未完成";

    public static string TargetType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST" => "貼文",
        "COMMENT" => "留言",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他目標類型"
    };

    public static string ReportReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "SPAM" => "垃圾內容",
        "HARASSMENT" => "騷擾或攻擊",
        "ILLEGAL_CONTENT" => "不當或違法內容",
        "MISINFORMATION" => "錯誤資訊",
        "COPYRIGHT" => "著作權問題",
        "OTHER" => "其他",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他檢舉理由"
    };

    public static string DiscountType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FIXED" => "折抵金額",
        "PERCENT" => "折扣百分比",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他折扣類型"
    };

    public static string CouponAcquisitionType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POINT_EXCHANGE" => "點數兌換",
        "ADMIN_GRANT" => "管理員發放",
        _ => string.IsNullOrWhiteSpace(value) ? "未設定" : "其他取得方式"
    };

    public static string Visibility(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "PUBLIC" => "公開",
        "FRIENDS" => "僅限好友",
        "PRIVATE" => "私人",
        _ => "其他範圍"
    };

    public static string PointReferenceType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "SHOWCASE" => "展示資料",
        "ORDER" => "訂單回饋",
        "GAME" => "遊戲獎勵",
        "EVENT" => "活動回饋",
        "ACHIEVEMENT" => "成就獎勵",
        _ => "其他異動"
    };

    public static string PointReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FIXTURE_GRANT" => "展示資料發放",
        "ADMIN_ADJUST" => "後台調整",
        "ORDER_REWARD" => "訂單回饋",
        "GAME_REWARD" => "遊戲獎勵",
        "EVENT_REWARD" => "活動回饋",
        "ACHIEVEMENT_REWARD" => "成就獎勵",
        _ => string.IsNullOrWhiteSpace(value) ? "未註明" : "其他原因"
    };
}
