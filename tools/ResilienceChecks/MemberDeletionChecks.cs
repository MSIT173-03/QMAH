using System.Data.Common;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Members;

internal static class MemberDeletionChecks
{
    public static async Task RunAsync()
    {
        foreach (var scenario in new[] { "password", "external", "rollback" })
        {
            await using var connection = new SqliteConnection("DataSource=:memory:;Foreign Keys=True");
            await connection.OpenAsync();
            var failure = new DeleteFailure();
            var options = new DbContextOptionsBuilder<QmahDbContext>().UseSqlite(connection).AddInterceptors(failure).Options;
            await using var db = new QmahDbContext(options);
            var sql = Regex.Replace(db.Database.GenerateCreateScript(), @"\(max\)", "", RegexOptions.IgnoreCase)
                .Replace("sysutcdatetime()", "CURRENT_TIMESTAMP")
                .Replace("(NEXT VALUE FOR [social].[MediaAssetSequence])", "0")
                .Replace("\"RowVersion\" BLOB NOT NULL", "\"RowVersion\" BLOB NOT NULL DEFAULT X'0102030405060708'");
            sql = Regex.Replace(sql, @"\bN(?=')", "");
            await using (var schema = connection.CreateCommand()) { schema.CommandText = sql; await schema.ExecuteNonQueryAsync(); }
            var now = DateTime.UtcNow;
            var actor = MakeUser("admin@deletion.test", now);
            var target = MakeUser(scenario == "external" ? null : "member@deletion.test", now);
            var other = MakeUser("other@deletion.test", now);
            if (scenario == "external") { target.UserName = "external-member"; target.PasswordHash = null; }
            var role = new IdentityRole<Guid>("Admin") { Id = Guid.NewGuid(), NormalizedName = "ADMIN" };
            var key = new KeyDefinition { Id = Guid.NewGuid(), Code = "KEY-NORMAL", Name = "一般鑰匙", ScopeType = "NORMAL", IsActive = true };
            db.AddRange(actor, target, other, role, key);
            db.Add(new IdentityUserRole<Guid> { UserId = actor.Id, RoleId = role.Id });
            foreach (var user in new[] { actor, target, other }) db.Add(new UserProfile { UserId = user.Id,
                Nickname = "Private nickname", Bio = "Private bio", Visibility = "PUBLIC", CreatedAt = now, UpdatedAt = now });
            db.AddRange(new PointBalance { UserId = target.Id, Balance = 123, UpdatedAt = now },
                new PointBalance { UserId = other.Id, Balance = 77, UpdatedAt = now });
            db.Add(new UserKeyBalance { UserId = target.Id, KeyDefinitionId = key.Id, Balance = 9, UpdatedAt = now });
            db.Add(new IdentityUserLogin<Guid> { UserId = target.Id, LoginProvider = "TestExternal", ProviderKey = "fake-subject", ProviderDisplayName = "Test provider" });
            db.Add(new IdentityUserToken<Guid> { UserId = target.Id, LoginProvider = "TestExternal", Name = "token", Value = "not-a-real-token" });
            var post = new SocialPost { Id = Guid.NewGuid(), UserId = other.Id, BoardCode = "GENERAL", Title = "Other member's post", Content = "Keep this content", Status = "PUBLISHED", CreatedAt = now, UpdatedAt = now };
            db.Add(new UserAddress { Id = Guid.NewGuid(), UserId = target.Id, AddressLabel = "Private address", RecipientName = "Private recipient",
                RecipientPhone = "private-phone", AddressLine = "Private street", CreatedAt = now, UpdatedAt = now });
            db.Add(new StoreOrder { Id = Guid.NewGuid(), UserId = target.Id, OrderNo = Guid.NewGuid().ToString("N"), Status = "PAID",
                RecipientName = "Private recipient", RecipientPhone = "private-phone", ShippingPostalCode = "100", ShippingCity = "Private city",
                ShippingDistrict = "Private district", ShippingAddressLine = "Private street", ShippingMethod = "HOME_DELIVERY",
                Subtotal = 100, TotalAmount = 100, CreatedAt = now, PaidAt = now });
            db.Add(post);
            db.Add(new SocialComment { Id = Guid.NewGuid(), PostId = post.Id, UserId = target.Id, Content = "Keep the shared discussion", Status = "PUBLISHED", CreatedAt = now, UpdatedAt = now });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var folder = Path.Combine(Path.GetTempPath(), "qmah-deletion-" + Guid.NewGuid().ToString("N"));
            var ownedFolder = Path.Combine(folder, target.Id.ToString("N"));
            Directory.CreateDirectory(ownedFolder);
            await File.WriteAllTextAsync(Path.Combine(ownedFolder, "avatar.jpg"), "isolated test file");
            try
            {
                var service = new MemberAccountDeletionService(db, new AvatarStoragePaths(folder), NullLogger<MemberAccountDeletionService>.Instance);
                Check(!(await service.DeleteAsync(actor.Id, actor.Id, actor.Email!)).Succeeded, "self-deletion must fail");
                Check(!(await service.DeleteAsync(other.Id, target.Id, target.Email ?? target.UserName!)).Succeeded, "ordinary members cannot delete");
                Check(!(await service.DeleteAsync(actor.Id, target.Id, "wrong-identity")).Succeeded, "wrong confirmation must fail");
                failure.Enabled = scenario == "rollback";
                var result = await service.DeleteAsync(actor.Id, target.Id, target.Email ?? target.UserName!);
                db.ChangeTracker.Clear();
                var user = await db.Users.SingleAsync(user => user.Id == target.Id);
                if (scenario == "rollback")
                {
                    Check(!result.Succeeded, "failed transaction must report failure");
                    Check(user.Email == target.Email && user.PasswordHash == target.PasswordHash, "rollback preserves identity");
                    Check(await db.PointBalances.AnyAsync(row => row.UserId == target.Id), "rollback preserves points");
                    Check(await db.UserLogins.AnyAsync(row => row.UserId == target.Id), "rollback preserves external login");
                    Check(Directory.Exists(ownedFolder), "rollback preserves avatar files");
                }
                else
                {
                    Check(result.Succeeded && MemberAccountDeletionService.IsDeleted(user), "account must be marked irreversibly deleted");
                    Check(user.PasswordHash is null && user.Email is null && user.PhoneNumber is null, "login and identity must be erased");
                    Check(!await db.UserLogins.AnyAsync(row => row.UserId == target.Id) && !await db.UserTokens.AnyAsync(row => row.UserId == target.Id), "external bindings and tokens must be removed");
                    Check(!await db.PointBalances.AnyAsync(row => row.UserId == target.Id) && !await db.UserKeyBalances.AnyAsync(row => row.UserId == target.Id), "points and keys must be removed");
                    Check(await db.PointBalances.Where(row => row.UserId == other.Id).Select(row => row.Balance).SingleAsync() == 77, "other member assets must remain");
                    Check(await db.SocialComments.AnyAsync(row => row.PostId == post.Id && row.UserId == target.Id), "shared discussion must remain");
                    Check(await db.UserProfiles.Where(row => row.UserId == target.Id).Select(row => row.Nickname).SingleAsync() == "已刪除會員", "author must be anonymous");
                    Check(!await service.Accounts.AnyAsync(row => row.Id == target.Id), "deleted anchor must not appear as a member");
                    Check(!Directory.Exists(ownedFolder), "owned avatar files must be removed");
                    Check(!await db.UserAddresses.AnyAsync(row => row.UserId == target.Id), "personal addresses must be removed");
                    var order = await db.StoreOrders.SingleAsync(row => row.UserId == target.Id);
                    Check(order.RecipientName == "已刪除會員" && order.RecipientPhone == "" && order.ShippingAddressLine == "", "order recipient must be anonymous");
                    Check(order.TotalAmount == 100 && order.Status == "PAID", "shared financial history must remain intact");
                    var rejected = false;
                    try { await MemberAccountDeletionService.EnsureNotDeletedAsync(db, target.Id, default); }
                    catch (InvalidOperationException) { rejected = true; }
                    Check(rejected, "deleted assets cannot be recreated");
                }
            }
            finally { Directory.Delete(folder, true); }
            Console.WriteLine($"Member deletion: {scenario} checks passed (isolated SQLite, foreign keys enabled)");
        }
    }
    private static ApplicationUser MakeUser(string? email, DateTime now) => new() { Id = Guid.NewGuid(),
        UserName = email ?? "external-member", NormalizedUserName = (email ?? "external-member").ToUpperInvariant(),
        Email = email, NormalizedEmail = email?.ToUpperInvariant(), PhoneNumber = "private-phone", PasswordHash = "not-a-real-password-hash",
        SecurityStamp = Guid.NewGuid().ToString("N"), ConcurrencyStamp = Guid.NewGuid().ToString("N"), CreatedAt = now, UpdatedAt = now };
    private static void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    private sealed class DeleteFailure : DbCommandInterceptor
    {
        public bool Enabled { get; set; }
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && command.CommandText.StartsWith("DELETE FROM \"UserKeyBalances\"", StringComparison.Ordinal))
                throw new SqliteException("Injected deletion failure", 11);
            return ValueTask.FromResult(result);
        }
    }
}
