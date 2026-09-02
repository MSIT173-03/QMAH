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
        _ => "其他範圍"
    };

    public static string AchievementCondition(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "POST_COUNT" => "發布貼文數",
        "COMMENT_COUNT" => "留言數",
        "EVENT_JOIN_COUNT" => "活動參與數",
        "EVENT_HOST_COUNT" => "建立活動數",
        "GAME_PLAY_COUNT" => "遊戲參與數",
        "GAME_COMPLETE_COUNT" => "多人遊戲完成場數",
        "GAME_ROUND_WIN_COUNT" => "多人遊戲勝出回合數",
        "GAME_WIN_COUNT" => "遊戲勝場數（相容）",
        "ARTIFACT_UNLOCK_COUNT" => "圖鑑解鎖數",
        "CATEGORY_COMPLETE_COUNT" => "完成分類數",
        "ERA_COMPLETE_COUNT" => "完成年代範圍數",
        "CATALOG_COMPLETION_PERCENT" => "圖鑑完成率",
        "MINIGAME_DETAIL_LOCATOR_COUNT" => "細節追蹤完成次數",
        "MINIGAME_ARTIFACT_PUZZLE_COUNT" => "館藏拼圖完成次數",
        "MINIGAME_MEMORY_MATCH_COUNT" => "館藏翻牌完成次數",
        "MINIGAME_STRIP_RESTORE_COUNT" => "長卷復位完成次數",
        "MINIGAME_GRADE_S_COUNT" => "Mini Game S 等級次數",
        null or "" => "未設定",
        _ => "其他條件"
    };

    public static string CouponStatus(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "AVAILABLE" => "可使用",
        "USED" => "已使用",
        "EXPIRED" => "已過期",
        "REVOKED" => "已撤銷",
        null or "" => "未設定",
        _ => "其他狀態"
    };

    public static string KeyTransactionReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ADMIN_GRANT" => "後台發放",
        "ADMIN_ADJUST" => "後台調整",
        "ADMIN_DELETE_BALANCE" => "刪除背包餘額",
        "GAME_REWARD" => "遊戲獎勵",
        "UNLOCK" => "解鎖消耗",
        null or "" => "未註明",
        _ => "其他原因"
    };

    public static string ReferenceType(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "ADMIN" => "後台操作",
        "SYSTEM" => "系統",
        "GAME" => "遊戲",
        "ORDER" => "訂單",
        "SHOWCASE" => "展示資料",
        null or "" => "—",
        _ => "其他來源"
    };

    public static string PointReason(string? value) => value?.Trim().ToUpperInvariant() switch
    {
        "FIXTURE_GRANT" => "測試資料發放",
        null or "" => "未註明",
        _ => "其他原因"
    };
}
