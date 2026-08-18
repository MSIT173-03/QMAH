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
        "BANNED" => "已停權",
        "DISABLED" => "已停用",
        "WAITING" => "等待中",
        "PLAYING" => "進行中",
        "COMPLETED" => "已完成",
        _ => value ?? "未設定"
    };

    public static string Board(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "GENERAL" => "綜合交流",
        "CATALOG" => "圖鑑研究",
        "GAME" => "鑑定遊戲",
        "EVENTS" => "活動消息",
        "DISCOVERY" => "探索發現",
        "REVIEW" => "鑑賞心得",
        _ => value ?? "未分類"
    };

    public static string Scope(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "NORMAL" => "一般鑰匙",
        "CATEGORY" => "分類鑰匙",
        "ERA" => "年代鑰匙",
        "UNIVERSAL" => "通用鑰匙",
        "GLOBAL" => "全域鑰匙",
        _ => value ?? "未設定"
    };

    public static string ConditionType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST_COUNT" => "發布貼文數",
        "COMMENT_COUNT" => "留言數",
        "ARTIFACT_UNLOCK_COUNT" => "解鎖文物數",
        "GAME_WIN_COUNT" => "遊戲勝場數",
        "GAME_PLAY_COUNT" => "遊戲參與次數",
        "EVENT_JOIN_COUNT" => "參加活動數",
        "POINT_TOTAL" => "累積點數",
        _ => value ?? "未設定"
    };

    public static string EventType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "OFFICIAL" => "官方活動",
        "PLAYER" => "玩家活動",
        _ => value ?? "未設定"
    };

    public static string ReviewStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "PENDING" => "待審核",
        "APPROVED" => "已核准",
        "REJECTED" => "已駁回",
        _ => value ?? "未設定"
    };

    public static string PublishStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "DRAFT" => "草稿",
        "PUBLISHED" => "已發布",
        "CANCELLED" => "已取消",
        _ => value ?? "未設定"
    };

    public static string TargetType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST" => "貼文",
        "COMMENT" => "留言",
        _ => value ?? "未設定"
    };

    public static string ReportReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "SPAM" => "垃圾內容",
        "HARASSMENT" => "騷擾或攻擊",
        "ILLEGAL_CONTENT" => "不當或違法內容",
        "MISINFORMATION" => "錯誤資訊",
        "COPYRIGHT" => "著作權問題",
        "OTHER" => "其他",
        _ => value ?? "未設定"
    };

    public static string DiscountType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FIXED" => "折抵金額",
        "PERCENT" => "折扣百分比",
        _ => value ?? "未設定"
    };

    public static string Visibility(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "PUBLIC" => "公開",
        "FRIENDS" => "僅限好友",
        "PRIVATE" => "私人",
        _ => value ?? "未設定"
    };
}
