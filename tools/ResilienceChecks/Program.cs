using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using QMAH.Api.Controllers.V1;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Economy;

await MemberDeletionChecks.RunAsync();
MiniGameEligibilityChecks.Run();

// Inject a transient failure after the balance and ledger have been changed in
// memory. Each retry must reread persisted state, not spend the same keys twice.
foreach (var bulk in new[] { false, true })
{
    await using var connection = new SqliteConnection("DataSource=:memory:;Foreign Keys=False");
    await connection.OpenAsync();
    var fault = new FailFirstUnlockSave();
    var options = new DbContextOptionsBuilder<QmahDbContext>()
        .UseSqlite(connection, sqlite => sqlite.ExecutionStrategy(deps => new TestRetryStrategy(deps)))
        .AddInterceptors(fault).Options;
    await using var db = new QmahDbContext(options);
    var schema = Regex.Replace(db.Database.GenerateCreateScript(), @"\(max\)", "", RegexOptions.IgnoreCase)
        .Replace("sysutcdatetime()", "CURRENT_TIMESTAMP")
        .Replace("(NEXT VALUE FOR [social].[MediaAssetSequence])", "0");
    var required = new[] { "Artifacts", "KeyDefinitions", "UserKeyBalances", "KeyTransactions", "ArtifactUnlocks" };
    foreach (var statement in Regex.Split(schema, @";\r?\n").Where(s => !string.IsNullOrWhiteSpace(s)))
    {
        try { await using var command = connection.CreateCommand(); command.CommandText = statement; await command.ExecuteNonQueryAsync(); }
        catch (SqliteException) when (!required.Any(table => statement.Contains('"' + table + '"'))) { }
    }
    var userId = Guid.NewGuid();
    var keyId = Guid.NewGuid();
    var count = bulk ? 4 : 1;
    var initialBalance = bulk ? 4 : 2;
    db.KeyDefinitions.Add(new KeyDefinition { Id = keyId, Code = "RETRY_TEST", Name = "test", ScopeType = "UNIVERSAL", IsActive = true });
    var artifacts = Enumerable.Range(0, count).Select(i => new Artifact {
        Id = Guid.NewGuid(), ArtifactRef = "TEST-" + i, Name = "test-" + i,
        PrimaryImagePath = "/test.png", SourceUrl = "https://example.invalid", IsActive = true,
        CategoryId = Guid.NewGuid(), EraBucketId = Guid.NewGuid()
    }).ToList();
    db.Artifacts.AddRange(artifacts);
    db.UserKeyBalances.Add(new UserKeyBalance { UserId = userId, KeyDefinitionId = keyId, Balance = initialBalance, UpdatedAt = DateTime.UtcNow });
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();
    fault.Armed = true;
    var service = new EconomyService(db, new GameDailyRewardService(db));
    if (bulk)
    {
        var result = await service.UnlockAllArtifactsAsync(userId, "RETRY_TEST");
        Check(result.Succeeded && result.Value!.UnlockedCount == count, "bulk unlock succeeds after transient save failure");
    }
    else
    {
        var result = await service.UnlockArtifactAsync(userId, "RETRY_TEST", artifacts[0].Id);
        Check(result.Succeeded && result.Value!.Unlocked, "single unlock succeeds after transient save failure");
    }
    db.ChangeTracker.Clear();
    Check(fault.Failures == 1, "the transient failure was exercised");
    Check(await db.ArtifactUnlocks.CountAsync(u => u.UserId == userId) == count, "no duplicate unlock rows");
    Check(await db.KeyTransactions.CountAsync(t => t.UserId == userId) == count, "no duplicate key ledger rows");
    Check(await db.UserKeyBalances.Where(b => b.UserId == userId).Select(b => b.Balance).SingleAsync() == initialBalance - count, "each key is spent exactly once");
}
// Ordinary text-only edits send an empty media list. This must not call
// Min() on an empty collection or terminate the request with a 500.
await using (var connection = new SqliteConnection("DataSource=:memory:;Foreign Keys=False"))
{
    await connection.OpenAsync();
    var options = new DbContextOptionsBuilder<QmahDbContext>().UseSqlite(connection).Options;
    await using var db = new QmahDbContext(options);
    var script = Regex.Replace(db.Database.GenerateCreateScript(), @"\(max\)", "", RegexOptions.IgnoreCase)
        .Replace("sysutcdatetime()", "CURRENT_TIMESTAMP")
        .Replace("(NEXT VALUE FOR [social].[MediaAssetSequence])", "0");
    foreach (var statement in Regex.Split(script, @";\r?\n").Where(s => !string.IsNullOrWhiteSpace(s)))
    {
        try { await using var command = connection.CreateCommand(); command.CommandText = statement; await command.ExecuteNonQueryAsync(); }
        catch (SqliteException) when (!statement.Contains("\"SocialPosts\"") && !statement.Contains("\"MediaAssets\"")) { }
    }
    var userId = Guid.NewGuid();
    var post = new SocialPost { Id = Guid.NewGuid(), UserId = userId, Title = "original", Content = "original",
        BoardCode = "GENERAL", PostType = "POST", PublisherType = "COMMUNITY", Status = "PUBLISHED",
        MediaLayout = "SECONDARY", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
    db.SocialPosts.Add(post); await db.SaveChangesAsync();
    var controller = new SocialController(db, null!, null!, null!, null!, null!, null!, null!, null!)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "checks")) } }
    };
    var result = await controller.UpdatePost(post.Id,
        new UpdateSocialPostRequest { Title = "updated", Content = "updated", MediaIds = [] });
    Check(result is OkObjectResult, "text-only post edit with an empty image list succeeds");
    db.ChangeTracker.Clear();
    Check((await db.SocialPosts.SingleAsync()).Content == "updated", "text-only edit is persisted");
    result = await controller.UpdatePost(post.Id,
        new UpdateSocialPostRequest { Title = "   ", Content = "must not be saved", MediaIds = [] });
    Check(result is ObjectResult { Value: ValidationProblemDetails problem }
        && problem.Errors.ContainsKey(nameof(UpdateSocialPostRequest.Title))
        && !controller.ModelState.IsValid, "whitespace-only title is rejected");
    db.ChangeTracker.Clear();
    Check((await db.SocialPosts.SingleAsync()).Content == "updated", "invalid edit leaves the saved post intact");
}
Console.WriteLine("Resilience checks passed.");
static void Check(bool success, string message)
{
    if (!success) throw new InvalidOperationException(message);
    Console.WriteLine("PASS " + message);
}
sealed class TransientTestFailure : Exception;
sealed class TestRetryStrategy(ExecutionStrategyDependencies dependencies)
    : ExecutionStrategy(dependencies, 1, TimeSpan.Zero)
{
    protected override bool ShouldRetryOn(Exception exception) => exception is TransientTestFailure;
}
sealed class FailFirstUnlockSave : SaveChangesInterceptor
{
    public bool Armed { get; set; }
    public int Failures { get; private set; }
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        if (Armed && Failures == 0 && eventData.Context!.ChangeTracker.Entries<ArtifactUnlock>().Any(e => e.State == EntityState.Added))
        {
            Failures++;
            throw new TransientTestFailure();
        }
        return ValueTask.FromResult(result);
    }
}
