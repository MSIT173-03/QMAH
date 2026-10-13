using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Infrastructure.Services.Members;

public sealed record MemberDeletionResult(bool Succeeded, string Message);

/// <summary>Remove authentication and private assets; preserve an anonymous FK anchor for shared history.</summary>
public sealed class MemberAccountDeletionService(QmahDbContext db, AvatarStoragePaths avatars,
    ILogger<MemberAccountDeletionService> logger)
{
    public const string DeletedPrefix = "__deleted__";
    public static bool IsDeleted(ApplicationUser user) => user.Status == "DISABLED"
        && user.Email is null && user.UserName?.StartsWith(DeletedPrefix, StringComparison.Ordinal) == true;
    public IQueryable<ApplicationUser> Accounts => db.Users.Where(user => user.Status != "DISABLED"
        || user.Email != null || user.UserName == null || !user.UserName.StartsWith(DeletedPrefix));

    public async Task<MemberDeletionResult> DeleteAsync(Guid actorId, Guid targetId,
        string confirmationEmail, CancellationToken cancellationToken = default)
    {
        if (actorId == targetId) return new(false, "不能刪除目前登入的管理員帳號。");
        string? oldAvatar = null;
        var verifiedTarget = false;
        MemberDeletionResult result;
        try
        {
            result = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
                var admins = from adminAccount in Accounts
                             join link in db.UserRoles on adminAccount.Id equals link.UserId
                             join role in db.Roles on link.RoleId equals role.Id
                             where role.NormalizedName == "ADMIN" && adminAccount.Status == "ACTIVE"
                             select adminAccount.Id;
                if (!await admins.AnyAsync(id => id == actorId, cancellationToken))
                    return new MemberDeletionResult(false, "只有啟用中的管理員可以刪除帳號。");
                var user = await db.Users.SingleOrDefaultAsync(user => user.Id == targetId, cancellationToken);
                if (user is null) return new(false, "這個帳號已不存在。");
                if (IsDeleted(user)) return verifiedTarget
                    ? new(true, "帳號與個人資產已刪除；涉及其他人的歷史紀錄已保留為匿名身分。")
                    : new(false, "這個帳號已刪除。");
                if (!string.Equals(user.Email ?? user.UserName ?? user.Id.ToString(), confirmationEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                    return new(false, "請輸入這個會員目前的完整帳號識別，以確認刪除對象。");
                verifiedTarget = true;
                if (await admins.AnyAsync(id => id == targetId, cancellationToken)
                    && await admins.CountAsync(cancellationToken) <= 1)
                    return new(false, "不能刪除最後一位啟用中的管理員。");
                // Prevent expiry/refund workers or an active room from recreating removed assets.
                if (await db.StoreOrders.AnyAsync(order => order.UserId == targetId && order.Status == "PENDING_PAYMENT", cancellationToken))
                    return new(false, "這個會員還有待付款或待處理的訂單，請先完成或取消訂單，再刪除帳號。");
                if (await db.GamePlayers.AnyAsync(player => player.UserId == targetId && player.ConnectionStatus != "LEFT"
                    && (player.Room.Status == "WAITING" || player.Room.Status == "PLAYING"), cancellationToken))
                    return new(false, "這個會員仍在遊戲房間中，請待離開房間後再刪除帳號。");

                var now = DateTime.UtcNow;
                oldAvatar = await db.UserProfiles.Where(profile => profile.UserId == targetId)
                    .Select(profile => profile.AvatarPath).SingleOrDefaultAsync(cancellationToken);
                user.Status = "DISABLED";
                user.UserName = DeletedPrefix + targetId.ToString("N");
                user.NormalizedUserName = user.UserName.ToUpperInvariant();
                user.Email = user.NormalizedEmail = user.PhoneNumber = user.PasswordHash = null;
                user.EmailConfirmed = user.PhoneNumberConfirmed = user.TwoFactorEnabled = false;
                user.LockoutEnabled = true;
                user.LockoutEnd = DateTimeOffset.MaxValue;
                user.AccessFailedCount = 0;
                user.SecurityStamp = Guid.NewGuid().ToString("N");
                user.ConcurrencyStamp = Guid.NewGuid().ToString("N");
                user.UpdatedAt = now;
                await db.SaveChangesAsync(cancellationToken);
                await db.UserRoles.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserClaims.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserLogins.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserTokens.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserProfiles.Where(row => row.UserId == targetId).ExecuteUpdateAsync(setters => setters
                    .SetProperty(row => row.Nickname, "已刪除會員").SetProperty(row => row.Bio, (string?)null)
                    .SetProperty(row => row.AvatarPath, "/images/avatars/qmah-curator.png")
                    .SetProperty(row => row.Visibility, "PRIVATE").SetProperty(row => row.UpdatedAt, now), cancellationToken);
                await db.GamePlayers.Where(row => row.UserId == targetId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.DisplayName, "已刪除會員"), cancellationToken);
                await db.StoreOrders.Where(row => row.UserId == targetId).ExecuteUpdateAsync(setters => setters
                    .SetProperty(row => row.RecipientName, "已刪除會員").SetProperty(row => row.RecipientPhone, "")
                    .SetProperty(row => row.ShippingPostalCode, "").SetProperty(row => row.ShippingCity, "")
                    .SetProperty(row => row.ShippingDistrict, "").SetProperty(row => row.ShippingAddressLine, "")
                    .SetProperty(row => row.UserCouponId, (Guid?)null), cancellationToken);
                await db.CommunityRewardCampaigns.Where(row => row.OwnerUserId == targetId && row.BudgetMode == "LIMITED")
                    .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.IsActive, false).SetProperty(row => row.UpdatedAt, now), cancellationToken);
                await db.UserEquippedTitles.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserAchievements.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserAddresses.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserCoupons.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.CartItems.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserNotifications.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.ArtifactUnlocks.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.MiniGameAttempts.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.DailyMemberActivities.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.PointTransactions.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.KeyTransactions.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.KeyProgressTransactions.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.PointBalances.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.UserKeyBalances.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await db.KeyProgressBalances.Where(row => row.UserId == targetId).ExecuteDeleteAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return new MemberDeletionResult(true, "帳號與個人資產已刪除；涉及其他人的歷史紀錄已保留為匿名身分。");
            });
        }
        catch (Exception exception) when (exception is DbUpdateException or DbException)
        {
            logger.LogError(exception, "Member deletion transaction failed for {UserId}", targetId);
            return new(false, "刪除未完成，資料庫變更已回復，請重新確認後再試。");
        }
        if (!result.Succeeded) return result;
        try
        {
            var folder = Path.Combine(avatars.RootPath, targetId.ToString("N"));
            if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true);
            if (oldAvatar?.StartsWith("/uploads/avatars/", StringComparison.Ordinal) == true)
            {
                var root = Path.GetFullPath(avatars.RootPath) + Path.DirectorySeparatorChar;
                var file = Path.GetFullPath(Path.Combine(root, oldAvatar["/uploads/avatars/".Length..]));
                if (file.StartsWith(root, StringComparison.Ordinal) && File.Exists(file)
                    && !await db.UserProfiles.AnyAsync(profile => profile.AvatarPath == oldAvatar, CancellationToken.None)) File.Delete(file);
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(exception, "Deleted member avatar cleanup remains pending for {UserId}", targetId);
            return result with { Message = result.Message + " 頭像檔案清理未完成，請檢查主機檔案權限。" };
        }
        return result;
    }

    public static async Task EnsureNotDeletedAsync(QmahDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(user => user.Id == userId && user.Status == "DISABLED" && user.Email == null
            && user.UserName != null && user.UserName.StartsWith(DeletedPrefix), cancellationToken))
            throw new InvalidOperationException("已刪除的帳號不能重新建立個人資產。");
    }
}
