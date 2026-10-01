using System.Data;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Common;

/// <summary>集中處理會員每日活動歷史與登入成就判定。</summary>
/// <remarks>
/// 這個服務只保存每位會員每天的活動事實；累積天數、連續天數、最高連續天數與登入率
/// 都在讀取時根據歷史資料計算。這樣不需要另外維護逐月或逐日統計快照，也能讓成就與
/// 營運中心使用同一個資料來源。RecordLoginAsync 由會員前台明確呼叫，管理後台登入不會自動觸發。
/// </remarks>
public sealed class DailyActivityService(QmahDbContext db, TimeProvider? timeProvider = null)
{
    public const string LoginActivityType = "LOGIN";
    public const string CheckInActivityType = "CHECK_IN";
    public const int DailyCheckInPoints = 3;
    public const int WeeklyStreakBonusPoints = 3;
    public const int MonthlyBonusLimit = 4;
    private DateTime UtcNow => (timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime;
    private static DateOnly TaiwanDate(DateTime utc) => DateOnly.FromDateTime(utc.AddHours(8));

    /// <summary>台灣時間每日簽到一次，基本 3 點與每連續 7 天的 3 點加成在同一交易入帳。</summary>
    public async Task<DailyActivitySummary> CheckInAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var awarded = await db.Database.CreateExecutionStrategy().ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, retryToken);
            var now = UtcNow;
            var today = TaiwanDate(now);
            var checkIn = await db.DailyMemberActivities.SingleOrDefaultAsync(
                item => item.UserId == userId && item.ActivityType == CheckInActivityType && item.ActivityDate == today, retryToken);
            if (checkIn is not null && await db.PointTransactions.AnyAsync(
                item => item.UserId == userId && item.ReferenceType == "DAILY_CHECK_IN" && item.ReferenceId == checkIn.Id, retryToken))
            {
                await transaction.CommitAsync(retryToken);
                return 0;
            }
            if (checkIn is null)
            {
                checkIn = CreateActivity(userId, CheckInActivityType, today, now);
                db.DailyMemberActivities.Add(checkIn);
            }
            var loginExists = await db.DailyMemberActivities.AnyAsync(
                item => item.UserId == userId && item.ActivityType == LoginActivityType && item.ActivityDate == today, retryToken);
            if (!loginExists)
                db.DailyMemberActivities.Add(CreateActivity(userId, LoginActivityType, today, now));
            var claimedDates = await GetCheckInDatesAsync(userId, today, retryToken);
            var nextStreak = CalculateMetrics(claimedDates, today, null).CurrentLoginStreak + 1;
            var bonusCount = await GetMonthlyBonusCountAsync(userId, today, retryToken);
            var points = DailyCheckInPoints + (nextStreak % 7 == 0 && bonusCount < MonthlyBonusLimit ? WeeklyStreakBonusPoints : 0);
            var balance = await db.PointBalances.SingleOrDefaultAsync(item => item.UserId == userId, retryToken);
            if (balance is null)
            {
                balance = new PointBalance { UserId = userId };
                db.PointBalances.Add(balance);
            }
            if (balance.Balance < 0 || balance.Balance > int.MaxValue - points)
                throw new OverflowException("點數餘額資料異常，簽到獎勵尚未領取，請聯絡管理員。");
            balance.Balance += points;
            balance.UpdatedAt = now;
            db.PointTransactions.Add(new PointTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Amount = points,
                Reason = points > DailyCheckInPoints
                    ? $"每日簽到：基本 {DailyCheckInPoints} 點＋連續 {nextStreak} 天加成 {WeeklyStreakBonusPoints} 點"
                    : $"每日簽到：基本 {DailyCheckInPoints} 點",
                ReferenceType = "DAILY_CHECK_IN", ReferenceId = checkIn.Id, CreatedAt = now
            });
            await db.SaveChangesAsync(retryToken);
            await EnsureLoginAchievementsAsync(userId, now, retryToken);
            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return points;
        }, cancellationToken);
        return (await GetLoginSummaryAsync(userId, cancellationToken)) with { AwardedPoints = awarded };
    }

    /// <summary>補近 7 天，每日一次免費，其餘扣 1～2 點；補發基本 3 點，不追補連續加成或登入事實。</summary>
    public async Task<DailyActivitySummary> MakeUpCheckInAsync(Guid userId, DateOnly targetDate, int expectedPointCost, CancellationToken cancellationToken = default)
    {
        var awarded = await db.Database.CreateExecutionStrategy().ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, retryToken);
            var now = UtcNow;
            var today = TaiwanDate(now);
            var age = today.DayNumber - targetDate.DayNumber;
            if (age < 1 || age > 7)
                throw new InvalidOperationException("只能補簽近 7 天內的日期。");
            var claimedDates = await GetCheckInDatesAsync(userId, today, retryToken);
            // 同一日期的重送不重複發點或扣點。
            if (claimedDates.Contains(targetDate))
            {
                await transaction.CommitAsync(retryToken);
                return 0;
            }
            var createdAt = await db.Users.Where(u => u.Id == userId).Select(u => u.CreatedAt).SingleAsync(retryToken);
            if (TaiwanDate(createdAt) > targetDate)
                throw new InvalidOperationException("註冊前的日期不能補簽。");
            var cost = await HasUsedFreeMakeUpTodayAsync(userId, today, retryToken) ? (age <= 3 ? 1 : 2) : 0;
            if (cost != expectedPointCost)
                throw new InvalidOperationException("補簽費用已變更，請重新整理後確認費用再補簽。");
            var balance = await db.PointBalances.SingleOrDefaultAsync(item => item.UserId == userId, retryToken);
            if (balance is null)
            {
                balance = new PointBalance { UserId = userId };
                db.PointBalances.Add(balance);
            }
            if (balance.Balance < 0 || balance.Balance > int.MaxValue - DailyCheckInPoints)
                throw new InvalidOperationException("點數餘額資料異常，尚未補簽，請聯絡管理員。");
            var activity = await db.DailyMemberActivities.SingleOrDefaultAsync(
                item => item.UserId == userId && item.ActivityType == CheckInActivityType && item.ActivityDate == targetDate, retryToken);
            if (activity is null)
            {
                activity = CreateActivity(userId, CheckInActivityType, targetDate, now);
                db.DailyMemberActivities.Add(activity);
            }
            balance.Balance += DailyCheckInPoints - cost;
            balance.UpdatedAt = now;
            db.PointTransactions.Add(new PointTransaction
            {
                Id = Guid.NewGuid(), UserId = userId, Amount = DailyCheckInPoints,
                Reason = $"每日簽到補簽：補 {targetDate:yyyy/MM/dd} 基本 {DailyCheckInPoints} 點，不追補加成",
                ReferenceType = cost == 0 ? "DAILY_CHECK_IN_MAKEUP_FREE" : "DAILY_CHECK_IN_MAKEUP", ReferenceId = activity.Id, CreatedAt = now
            });
            if (cost > 0)
                db.PointTransactions.Add(new PointTransaction
                {
                    Id = Guid.NewGuid(), UserId = userId, Amount = -cost,
                    Reason = $"每日簽到補簽費用：補 {targetDate:yyyy/MM/dd}（{age} 天前），扣 {cost} 點",
                    ReferenceType = "DAILY_CHECK_IN_MAKEUP_FEE", ReferenceId = activity.Id, CreatedAt = now
                });
            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return DailyCheckInPoints - cost;
        }, cancellationToken);
        return (await GetLoginSummaryAsync(userId, cancellationToken)) with { AwardedPoints = awarded };
    }

    private static DateTime MonthStartUtc(DateOnly today) =>
        new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(-8);

    private Task<int> GetMonthlyBonusCountAsync(Guid userId, DateOnly today, CancellationToken cancellationToken)
    {
        var start = MonthStartUtc(today);
        var end = start.AddHours(8).AddMonths(1).AddHours(-8);
        return db.PointTransactions.CountAsync(p => p.UserId == userId && p.ReferenceType == "DAILY_CHECK_IN"
            && p.Amount > DailyCheckInPoints && p.CreatedAt >= start && p.CreatedAt < end, cancellationToken);
    }

    private Task<bool> HasUsedFreeMakeUpTodayAsync(Guid userId, DateOnly today, CancellationToken cancellationToken)
    {
        var start = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(-8);
        var end = start.AddDays(1);
        return db.PointTransactions.AnyAsync(p => p.UserId == userId && p.ReferenceType == "DAILY_CHECK_IN_MAKEUP_FREE"
            && p.CreatedAt >= start && p.CreatedAt < end, cancellationToken);
    }

    private static DailyMemberActivity CreateActivity(Guid userId, string type, DateOnly date, DateTime now) => new()
    {
        Id = Guid.NewGuid(), UserId = userId, ActivityType = type, ActivityDate = date,
        OccurrenceCount = 1, FirstOccurredAt = now, LastOccurredAt = now, CreatedAt = now, UpdatedAt = now
    };

    /// <summary>記錄一次會員前台登入活動，並依目前啟用的登入成就補發尚未取得的成就。</summary>
    public async Task<DailyActivitySummary> RecordLoginAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // integration: 登入事實、成就取得與交易提交必須放在同一個可重試交易中；
        // SQL 暫時失敗時整段重做，避免只重做其中一次 SaveChanges 造成成就或活動資料不一致。
        var strategy = db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            var now = UtcNow;
            var today = TaiwanDate(now);

            var activity = await db.DailyMemberActivities
                .SingleOrDefaultAsync(
                    item => item.UserId == userId
                        && item.ActivityType == LoginActivityType
                        && item.ActivityDate == today,
                    cancellationToken);

            if (activity is null)
            {
                db.DailyMemberActivities.Add(new DailyMemberActivity
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    ActivityType = LoginActivityType,
                    ActivityDate = today,
                    OccurrenceCount = 1,
                    FirstOccurredAt = now,
                    LastOccurredAt = now,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                // 同一天只更新歷史事實的次數與最後時間，不增加累積登入天數。
                activity.OccurrenceCount =
                    checked(activity.OccurrenceCount + 1);

                activity.LastOccurredAt = now;
                activity.UpdatedAt = now;
            }

            await db.SaveChangesAsync(cancellationToken);

            await EnsureLoginAchievementsAsync(
                userId,
                now,
                cancellationToken);

            await db.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        });

        return await GetLoginSummaryAsync(
            userId,
            cancellationToken);
    }

    /// <summary>依會員的登入歷史即時計算每日登入進度。</summary>
    public async Task<DailyActivitySummary> GetLoginSummaryAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var today = TaiwanDate(UtcNow);
        var checkInDates = await GetCheckInDatesAsync(userId, today, cancellationToken);
        var checkInMetrics = CalculateMetrics(checkInDates, today, null);
        var hasCheckedIn = checkInDates.Contains(today);
        var rewardStreak = checkInMetrics.CurrentLoginStreak + (hasCheckedIn ? 0 : 1);
        var bonusCount = await GetMonthlyBonusCountAsync(userId, today, cancellationToken);
        var dailyReward = DailyCheckInPoints + (rewardStreak > 0 && rewardStreak % 7 == 0
            && bonusCount < MonthlyBonusLimit ? WeeklyStreakBonusPoints : 0);
        if (hasCheckedIn)
            dailyReward = await db.PointTransactions.Where(p => p.UserId == userId && p.ReferenceType == "DAILY_CHECK_IN"
                && db.DailyMemberActivities.Any(a => a.Id == p.ReferenceId && a.ActivityDate == today))
                .Select(p => p.Amount).SingleAsync(cancellationToken);

        var dates = await GetLoginDatesAsync(
            userId,
            today,
            cancellationToken);

        var memberCreatedAt = await db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => (DateTime?)user.CreatedAt)
            .SingleOrDefaultAsync(cancellationToken);

        var metrics = CalculateMetrics(
            dates,
            today,
            memberCreatedAt);

        var usedFreeMakeUp = await HasUsedFreeMakeUpTodayAsync(userId, today, cancellationToken);
        var makeUpDays = Enumerable.Range(1, 7)
            .Where(age => !checkInDates.Contains(today.AddDays(-age)) && memberCreatedAt.HasValue
                && TaiwanDate(memberCreatedAt.Value) <= today.AddDays(-age))
            .Select(age => new MakeUpCheckInDay(today.AddDays(-age), usedFreeMakeUp ? (age <= 3 ? 1 : 2) : 0))
            .ToArray();

        return new DailyActivitySummary(
            dates.Count == 0 ? null : dates[^1],
            dates.Count > 0 && dates[^1] == today,
            metrics.TotalLoginDays,
            metrics.CurrentLoginStreak,
            metrics.LongestLoginStreak,
            metrics.LifetimeLoginRate,
            hasCheckedIn, dailyReward, 0, checkInMetrics.CurrentLoginStreak,
            Math.Max(0, MonthlyBonusLimit - bonusCount), makeUpDays);
    }

    private async Task<IReadOnlyList<DateOnly>> GetLoginDatesAsync(
        Guid userId,
        DateOnly throughDate,
        CancellationToken cancellationToken)
    {
        return await db.DailyMemberActivities
            .AsNoTracking()
            .Where(item =>
                item.UserId == userId
                && item.ActivityType == LoginActivityType
                && item.ActivityDate <= throughDate)
            .OrderBy(item => item.ActivityDate)
            .Select(item => item.ActivityDate)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<DateOnly>> GetCheckInDatesAsync(Guid userId, DateOnly today, CancellationToken cancellationToken) =>
        await db.DailyMemberActivities.AsNoTracking()
            .Where(item => item.UserId == userId && item.ActivityType == CheckInActivityType && item.ActivityDate <= today
                && db.PointTransactions.Any(p => p.UserId == userId
                    && (p.ReferenceType == "DAILY_CHECK_IN" || p.ReferenceType == "DAILY_CHECK_IN_MAKEUP"
                        || p.ReferenceType == "DAILY_CHECK_IN_MAKEUP_FREE") && p.ReferenceId == item.Id))
            .OrderBy(item => item.ActivityDate).Select(item => item.ActivityDate).ToListAsync(cancellationToken);

    private async Task EnsureLoginAchievementsAsync(
        Guid userId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var today = TaiwanDate(now);

        var dates = await GetLoginDatesAsync(
            userId,
            today,
            cancellationToken);

        if (dates.Count == 0)
            return;

        var metrics = CalculateMetrics(
            dates,
            today,
            memberCreatedAt: null);

        var definitions = await db.Achievements
            .Where(item =>
                item.Status == "ACTIVE"
                && (
                    item.ConditionType == "DAILY_LOGIN_COUNT"
                    || item.ConditionType == "DAILY_LOGIN_STREAK"
                ))
            .ToListAsync(cancellationToken);

        if (definitions.Count == 0)
            return;

        var achievementIds = definitions
            .Select(item => item.Id)
            .ToList();

        var earned = await db.UserAchievements
            .Where(item =>
                item.UserId == userId
                && achievementIds.Contains(item.AchievementId))
            .Select(item => item.AchievementId)
            .ToHashSetAsync(cancellationToken);

        foreach (var definition in definitions)
        {
            var progress =
                definition.ConditionType == "DAILY_LOGIN_STREAK"
                    ? metrics.CurrentLoginStreak
                    : metrics.TotalLoginDays;

            if (
                progress < definition.ThresholdValue
                || earned.Contains(definition.Id)
            )
            {
                continue;
            }

            // 登入成就只留下取得紀錄，不發鑑定點數、鑰匙或優惠券，
            // 避免 Prestige 反向形成經濟循環。
            db.UserAchievements.Add(new UserAchievement
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                AchievementId = definition.Id,
                AchievedAt = now,
                IsDisplayed = false
            });
        }
    }

    private static LoginMetrics CalculateMetrics(
        IReadOnlyList<DateOnly> dates,
        DateOnly today,
        DateTime? memberCreatedAt)
    {
        if (dates.Count == 0)
            return new LoginMetrics(0, 0, 0, 0m);

        var longestStreak = 0;
        var trailingStreak = 0;
        DateOnly? previousDate = null;

        foreach (var date in dates)
        {
            trailingStreak =
                previousDate.HasValue
                && previousDate.Value.AddDays(1) == date
                    ? trailingStreak + 1
                    : 1;

            longestStreak = Math.Max(
                longestStreak,
                trailingStreak);

            previousDate = date;
        }

        var currentStreak =
            dates[^1] >= today.AddDays(-1)
                ? trailingStreak
                : 0;

        var startDate =
            memberCreatedAt.HasValue
                ? TaiwanDate(memberCreatedAt.Value)
                : dates[0];

        var eligibleDays = Math.Max(
            1,
            today.DayNumber - startDate.DayNumber + 1);

        var loginRate = Math.Clamp(
            Math.Round(
                dates.Count / (decimal)eligibleDays,
                4,
                MidpointRounding.AwayFromZero),
            0m,
            1m);

        return new LoginMetrics(
            dates.Count,
            currentStreak,
            longestStreak,
            loginRate);
    }

    private sealed record LoginMetrics(
        int TotalLoginDays,
        int CurrentLoginStreak,
        int LongestLoginStreak,
        decimal LifetimeLoginRate);
}

/// <summary>根據登入歷史即時計算出的會員進度，不是資料庫快照。</summary>
public sealed record DailyActivitySummary(
    DateOnly? LastLoginDate,
    bool HasLoggedInToday,
    int TotalLoginDays,
    int CurrentLoginStreak,
    int LongestLoginStreak,
    decimal LifetimeLoginRate,
    bool HasCheckedInToday = false,
    int DailyPointReward = DailyActivityService.DailyCheckInPoints,
    int AwardedPoints = 0,
    int CurrentCheckInStreak = 0,
    int RemainingMonthlyBonuses = DailyActivityService.MonthlyBonusLimit,
    IReadOnlyList<MakeUpCheckInDay>? MakeUpDays = null);

public sealed record MakeUpCheckInDay(DateOnly Date, int PointCost);
