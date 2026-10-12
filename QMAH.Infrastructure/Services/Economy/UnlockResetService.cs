using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Economy;

/// <summary>後台清除文物解鎖：鑰匙解鎖的會退回鑰匙背包並寫流水，遊戲獎勵與管理員解鎖不退。</summary>
public sealed class UnlockResetService(QmahDbContext db)
{
    public const string RefundReason = "後台返還鑰匙（清除解鎖）";

    public async Task<(int Removed, int Refunded)> ResetAsync(Guid? userId, Guid? categoryId, Guid? adminId, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var query = db.ArtifactUnlocks.Include(item => item.KeyTransaction).AsQueryable();
        if (userId is { } uid) query = query.Where(item => item.UserId == uid);
        if (categoryId is { } cid) query = query.Where(item => item.Artifact.CategoryId == cid);
        var unlocks = await query.ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var refunded = 0;
        var groups = unlocks
            .Where(item => item.UnlockMethod == "KEY" && item.KeyTransaction is not null)
            .GroupBy(item => (item.UserId, item.KeyTransaction!.KeyDefinitionId));
        foreach (var group in groups)
        {
            var (memberId, keyId) = group.Key;
            var amount = group.Count();
            var balance = await db.UserKeyBalances.SingleOrDefaultAsync(item => item.UserId == memberId && item.KeyDefinitionId == keyId, cancellationToken);
            if (balance is null)
            {
                balance = new UserKeyBalance { UserId = memberId, KeyDefinitionId = keyId, Balance = 0, UpdatedAt = now };
                db.UserKeyBalances.Add(balance);
            }
            balance.Balance += amount;
            balance.UpdatedAt = now;
            db.KeyTransactions.Add(new KeyTransaction
            {
                Id = Guid.NewGuid(), UserId = memberId, KeyDefinitionId = keyId, Amount = amount,
                Reason = RefundReason, ReferenceType = "ADMIN_UNLOCK_RESET",
                CreatedByAdminUserId = adminId, CreatedAt = now
            });
            refunded += amount;
        }
        db.ArtifactUnlocks.RemoveRange(unlocks);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return (unlocks.Count, refunded);
    }

    /// <summary>替會員解鎖全部（或某分類）尚未解鎖的文物，不扣鑰匙，記為管理員解鎖。</summary>
    public async Task<int> GrantAsync(Guid userId, Guid? categoryId, CancellationToken cancellationToken)
    {
        var owned = db.ArtifactUnlocks.Where(item => item.UserId == userId).Select(item => item.ArtifactId);
        var query = db.Artifacts.Where(item => item.IsActive && !owned.Contains(item.Id));
        if (categoryId is { } cid) query = query.Where(item => item.CategoryId == cid);
        var ids = await query.Select(item => item.Id).ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        db.ArtifactUnlocks.AddRange(ids.Select(id => new ArtifactUnlock { Id = Guid.NewGuid(), UserId = userId, ArtifactId = id, UnlockMethod = "ADMIN", UnlockedAt = now }));
        await db.SaveChangesAsync(cancellationToken);
        return ids.Count;
    }
}
