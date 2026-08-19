namespace QMAH.Web.Infrastructure.AdminNavigation;

public static class AdminCodeLabels
{
    public static string KeyScope(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "NORMAL" => "一般鑰匙",
        "CATEGORY" => "分類鑰匙",
        "ERA" => "年代鑰匙",
        "UNIVERSAL" => "萬用鑰匙",
        null or "" => "未設定",
        _ => value
    };

    public static string AchievementCondition(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST_COUNT" => "發布貼文數",
        "COMMENT_COUNT" => "留言數",
        "EVENT_JOIN_COUNT" => "活動參與數",
        "GAME_PLAY_COUNT" => "遊戲參與數",
        "ARTIFACT_UNLOCK_COUNT" => "圖鑑解鎖數",
        null or "" => "未設定",
        _ => value
    };

    public static string CouponStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "AVAILABLE" => "可使用",
        "USED" => "已使用",
        "EXPIRED" => "已過期",
        null or "" => "未設定",
        _ => value
    };

    public static string KeyTransactionReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ADMIN_GRANT" => "後台發放",
        "ADMIN_ADJUST" => "後台調整",
        "ADMIN_DELETE_BALANCE" => "刪除背包餘額",
        "GAME_REWARD" => "遊戲獎勵",
        "UNLOCK" => "解鎖消耗",
        null or "" => "未註明",
        _ => value
    };

    public static string ReferenceType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ADMIN" => "後台操作",
        "SYSTEM" => "系統",
        "GAME" => "遊戲",
        "ORDER" => "訂單",
        "SHOWCASE" => "展示資料",
        null or "" => "—",
        _ => value
    };

    public static string PointReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FIXTURE_GRANT" => "測試資料發放",
        null or "" => "未註明",
        _ => value
    };
}
