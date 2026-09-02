namespace QMAH.Api.Controllers.V1;

/// <summary>依會員活動歷史即時計算出的每日登入與簽到進度。</summary>
/// <remarks>
/// LifetimeLoginRate 是會員建立日至目前日期的登入天數比例，並非資料庫中預先保存的統計快照；
/// 若要查看選定期間的整體登入率，使用營運中心依每日活動歷史計算的區間統計。
/// </remarks>
public sealed record DailyActivityDto(
    DateOnly? LastLoginDate,
    bool HasLoggedInToday,
    int TotalLoginDays,
    int CurrentLoginStreak,
    int LongestLoginStreak,
    decimal LifetimeLoginRate);
