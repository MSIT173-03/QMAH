namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 活動時間與名額的共用規則，前台 API（SocialController）與後台（SocialEventAdminController）都呼叫這裡，
/// 避免兩邊各寫一份而規則不一致。
/// </summary>
/// <remarks>
/// 活動的開始、結束、報名截止時間都是使用者輸入的「台灣當地時間」，資料庫直接保存輸入值（不帶時區）。
/// 因此判斷「現在」也必須用台灣當地時間；不能用 DateTime.UtcNow，否則與台灣差 8 小時，
/// 報名截止會晚 8 小時才生效。
/// </remarks>
public static class EventScheduleRules
{
    /// <summary>名額上限的合理範圍（避免輸入荒謬的數字）。</summary>
    public const int MaxCapacity = 10000;

    private static readonly Lazy<TimeZoneInfo> TaipeiZone = new(ResolveTaipeiZone);

    /// <summary>目前的台灣當地時間（UTC+8），與活動時間欄位使用同一種時間基準。</summary>
    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TaipeiZone.Value);

    /// <summary>
    /// 檢查活動時間與名額。回傳空清單代表通過。
    /// </summary>
    /// <param name="isNewEvent">新建活動才要求開始時間、報名截止不能早於現在；編輯既有活動時不追溯。</param>
    /// <param name="currentRegistrations">編輯時目前已報名（REGISTERED／ATTENDED）的人數，人數上限不能低於它。</param>
    public static IReadOnlyList<ScheduleIssue> Validate(
        DateTime startAt,
        DateTime endAt,
        DateTime? registrationEndAt,
        int? capacity,
        bool isNewEvent,
        int currentRegistrations = 0)
    {
        var issues = new List<ScheduleIssue>();
        var now = Now;

        if (endAt <= startAt)
            issues.Add(new ScheduleIssue("EndAt", "結束時間必須晚於開始時間。"));

        if (registrationEndAt.HasValue && registrationEndAt.Value > startAt)
            issues.Add(new ScheduleIssue("RegistrationEndAt", "報名截止時間不能晚於開始時間。"));

        if (isNewEvent)
        {
            if (startAt <= now)
                issues.Add(new ScheduleIssue("StartAt", "開始時間必須晚於現在。"));

            if (registrationEndAt.HasValue && registrationEndAt.Value <= now)
                issues.Add(new ScheduleIssue("RegistrationEndAt", "報名截止時間必須晚於現在。"));
        }

        if (capacity.HasValue)
        {
            if (capacity.Value < 1 || capacity.Value > MaxCapacity)
            {
                issues.Add(new ScheduleIssue("Capacity", $"人數上限必須介於 1 到 {MaxCapacity} 之間。"));
            }
            else if (capacity.Value < currentRegistrations)
            {
                issues.Add(new ScheduleIssue(
                    "Capacity",
                    $"人數上限不能低於目前已報名人數（{currentRegistrations} 人）。"));
            }
        }

        return issues;
    }

    private static TimeZoneInfo ResolveTaipeiZone()
    {
        // Linux／macOS 用 IANA 名稱，Windows 用 Windows 名稱；兩個都找不到時退回固定的 UTC+8（台灣沒有夏令時間）。
        foreach (var id in new[] { "Asia/Taipei", "Taipei Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("UTC+8", TimeSpan.FromHours(8), "UTC+8", "UTC+8");
    }
}

/// <summary>一筆驗證問題：Field 對應表單／DTO 的屬性名稱，Message 是給使用者看的中文訊息。</summary>
public sealed record ScheduleIssue(string Field, string Message);
