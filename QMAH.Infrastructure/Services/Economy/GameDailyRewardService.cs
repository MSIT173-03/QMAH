using System.Data;
using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Economy;

/// <summary>單人與多人共用點數上限；每日突破沿用會員活動紀錄，不影響鑰匙。</summary>
public sealed class GameDailyRewardService(QmahDbContext db)
{
    public const int BaseLimit = 100;
    public const int BonusLimit = 30;
    private const string BreakthroughType = "GAME_BREAKTHROUGH";

    public async Task<MiniGameRewardStatusView> GetStatusAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var start = DateTime.UtcNow.AddHours(8).Date.AddHours(-8);
        var end = start.AddDays(1);
        var (unlocked, earned) = await GetPointBudgetAsync(userId, start, cancellationToken);
        var multiplayer = await db.GamePlayers.AsNoTracking().AnyAsync(item => item.UserId == userId
            && !item.Room.IsShowcase && item.Room.Status == "COMPLETED" && item.Room.CompletedAt >= start && item.Room.CompletedAt < end, cancellationToken);
        var modes = await db.MiniGameAttempts.AsNoTracking().Where(item => item.UserId == userId
            && item.Status == "COMPLETED" && item.CompletedAt >= start && item.CompletedAt < end
            && (item.Grade == "B" || item.Grade == "A" || item.Grade == "S"))
            .Select(item => item.GameModeDefinition.Code).Distinct().CountAsync(cancellationToken);
        var limit = BaseLimit + (unlocked ? BonusLimit : 0);
        var keyPolicy = await GetKeyPolicyAsync(userId, cancellationToken);
        var keyToday = await db.KeyProgressTransactions.AsNoTracking()
            .Where(item => item.UserId == userId && item.Amount > 0 && item.CreatedAt >= start && item.CreatedAt < end
                && (item.ReferenceType == "MINIGAME_REWARD" || item.ReferenceType == "MAIN_GAME_REWARD"))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0m;
        return new(limit, Math.Max(0, limit - earned), end, earned, BaseLimit, BonusLimit,
            unlocked, !unlocked && (multiplayer || modes >= 3), modes, multiplayer,
            keyPolicy.Collected, keyPolicy.Total, keyPolicy.Divisor, keyToday, EconomyService.DailyKeyProgressLimit);
    }

    public async Task<GameKeyPolicyView> GetKeyPolicyAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var total = await db.Artifacts.CountAsync(item => item.IsActive, cancellationToken);
        var collected = await db.Artifacts.CountAsync(item => item.IsActive
            && db.ArtifactUnlocks.Any(unlock => unlock.UserId == userId && unlock.ArtifactId == item.Id), cancellationToken);
        // 沒有啟用文物時不視為全收集，也不降低獎勵。
        byte divisor = total == 0 ? (byte)1 : collected == total ? (byte)4
            : (long)collected * 5 >= (long)total * 4 ? (byte)2 : (byte)1;
        return new(collected, total, divisor);
    }

    // 呼叫端已有 Serializable 結算交易，預算查詢與點數入帳必須在同一筆交易內。
    public async Task<int> LimitPointsAsync(Guid userId, int proposed, CancellationToken cancellationToken)
    {
        if (proposed <= 0) return 0;

        // 結算只需要剩餘點數，不必重查突破資格、多人紀錄和圖鑑完成度。
        var start = DateTime.UtcNow.AddHours(8).Date.AddHours(-8);
        var (unlocked, earned) = await GetPointBudgetAsync(userId, start, cancellationToken);
        return Math.Min(proposed, Math.Max(0, BaseLimit + (unlocked ? BonusLimit : 0) - earned));
    }

    private async Task<(bool Unlocked, int Earned)> GetPointBudgetAsync(
        Guid userId, DateTime start, CancellationToken cancellationToken)
    {
        var end = start.AddDays(1);
        var rewardDate = DateOnly.FromDateTime(start.AddHours(8));
        var unlocked = await db.DailyMemberActivities.AsNoTracking().AnyAsync(item => item.UserId == userId
            && item.ActivityType == BreakthroughType && item.ActivityDate == rewardDate, cancellationToken);
        var earned = await db.PointTransactions.AsNoTracking().Where(item => item.UserId == userId
            && item.CreatedAt >= start && item.CreatedAt < end && item.Amount > 0
            && (item.ReferenceType == "MINIGAME_REWARD" || item.ReferenceType == "MAIN_GAME_REWARD"))
            .SumAsync(item => (int?)item.Amount, cancellationToken) ?? 0;
        return (unlocked, earned);
    }

    public async Task<MiniGameRewardStatusView> UnlockAsync(Guid userId, CancellationToken cancellationToken = default)
        => await db.Database.CreateExecutionStrategy().ExecuteAsync(async token =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
            var status = await GetStatusAsync(userId, token);
            if (status.CanBreakthrough)
            {
                // 解鎖只記錄每日活動事實，不產生點數流水或增加餘額。
                var now = DateTime.UtcNow;
                db.DailyMemberActivities.Add(new DailyMemberActivity { Id = Guid.NewGuid(), UserId = userId,
                    ActivityType = BreakthroughType, ActivityDate = DateOnly.FromDateTime(status.ResetsAt.AddHours(8).AddDays(-1)),
                    OccurrenceCount = 1, FirstOccurredAt = now, LastOccurredAt = now, CreatedAt = now, UpdatedAt = now });
                await db.SaveChangesAsync(token);
                status = await GetStatusAsync(userId, token);
            }
            await transaction.CommitAsync(token);
            return status;
        }, cancellationToken);
}

public sealed record MiniGameRewardStatusView(int DailyLimit, int Remaining, DateTime ResetsAt,
    int Earned, int BaseLimit, int BonusLimit, bool BreakthroughUnlocked, bool CanBreakthrough,
    int CompletedModes, bool HasCompletedMultiplayer,
    int CollectedArtifacts, int TotalArtifacts, byte KeyRewardDivisor,
    decimal KeyProgressToday = 0m, decimal KeyProgressLimit = 0m);

public sealed record GameKeyPolicyView(int Collected, int Total, byte Divisor);
