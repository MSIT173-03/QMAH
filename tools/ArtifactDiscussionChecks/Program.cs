using System.Data.Common;
using System.Globalization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Social;

// Uses only an isolated, uniquely named LocalDB database; never connects to QMAH.
var databaseName = "QMAH_DiscussionChecks_" + Guid.NewGuid().ToString("N");
var builder = new SqlConnectionStringBuilder
{
    DataSource = @"(localdb)\MSSQLLocalDB", InitialCatalog = "master",
    IntegratedSecurity = true, TrustServerCertificate = true, ConnectTimeout = 10
};
await using var master = new SqlConnection(builder.ConnectionString);
await master.OpenAsync();
await ExecuteMaster($"CREATE DATABASE [{databaseName}]");
builder.InitialCatalog = databaseName;
var connectionString = builder.ConnectionString;
var creator = Guid.NewGuid();
var commenter = Guid.NewGuid();
try
{
    await using (var db = CreateContext())
    {
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA [catalog]");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA [social]");
        await db.Database.ExecuteSqlRawAsync("CREATE SCHEMA [user]");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE [catalog].[Artifacts] ([Id] uniqueidentifier NOT NULL PRIMARY KEY, [Name] nvarchar(500) NOT NULL, [IsActive] bit NOT NULL)");
        // Build the three service-owned tables from their real EF mappings, without unrelated tables.
        foreach (var type in new[] { typeof(SocialPost), typeof(SocialComment), typeof(UserNotification) })
        {
            var entity = db.Model.FindEntityType(type)!;
            var table = StoreObjectIdentifier.Table(entity.GetTableName()!, entity.GetSchema());
            var columns = entity.GetProperties().Select(property =>
            {
                var defaultSql = property.GetDefaultValueSql();
                var defaultValue = property.FindAnnotation(RelationalAnnotationNames.DefaultValue)?.Value;
                defaultSql ??= defaultValue switch
                {
                    null => null,
                    string value => "N'" + value.Replace("'", "''") + "'",
                    bool value => value ? "1" : "0",
                    _ => Convert.ToString(defaultValue, CultureInfo.InvariantCulture)
                };
                return $"[{property.GetColumnName(table)}] {property.GetColumnType()} {(property.IsNullable ? "NULL" : "NOT NULL")}{(defaultSql is null ? "" : " DEFAULT (" + defaultSql + ")")}";
            });
            var sql = $"CREATE TABLE [{table.Schema}].[{table.Name}] ({string.Join(", ", columns)}, PRIMARY KEY ([Id]))";
            await db.Database.ExecuteSqlRawAsync(sql);
        }
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE [social].[SocialComments] ADD FOREIGN KEY ([PostId]) REFERENCES [social].[SocialPosts] ([Id])");
        await db.Database.ExecuteSqlRawAsync("CREATE INDEX [IX_Discussion_Artifact] ON [social].[SocialPosts] ([ArtifactId], [PostType], [Status], [CreatedAt], [Id])");
    }

    var artifactId = await CreateArtifact();
    ArtifactDiscussionResult first;
    await using (var db = CreateContext())
    {
        first = (await Service(db).EnsureAsync(artifactId, creator, "  第一則留言  "))!;
        Check(first.Created, "first request creates a discussion");
        Check(await db.SocialComments.AnyAsync(c => c.Id == first.CommentId && c.PostId == first.PostId && c.Content == "第一則留言"), "first comment is saved on the returned post");
        Check(await db.SocialPosts.AnyAsync(p => p.Id == first.PostId && p.Status == "PUBLISHED" && p.BoardCode == "CATALOG"), "created discussion is discoverable by the frontend");
    }
    await using (var db = CreateContext())
    {
        var next = (await Service(db).EnsureAsync(artifactId, commenter, "接續討論"))!;
        Check(!next.Created && next.PostId == first.PostId, "existing discussion receives the new comment");
        Check(await db.SocialPosts.CountAsync(p => p.ArtifactId == artifactId) == 1, "existing discussion is not duplicated");
        Check(await db.UserNotifications.CountAsync(n => n.TargetUrl == $"/social/posts/{first.PostId}") == 1, "author receives one notification");
    }

    foreach (var afterCommit in new[] { false, true })
    {
        var fault = new CommitFault(afterCommit);
        await using var db = CreateContext(fault);
        var result = (await Service(db).EnsureAsync(artifactId, commenter, afterCommit ? "提交回應遺失" : "提交前失敗"))!;
        Check(fault.Thrown, "transient commit failure was injected");
        Check(result.PostId == first.PostId && !result.Created, "retry returns the original discussion");
        Check(await db.SocialComments.CountAsync(c => c.Id == result.CommentId) == 1, "retry saves exactly one comment");
    }
    await using (var db = CreateContext())
    {
        Check(await db.SocialComments.CountAsync(c => c.PostId == first.PostId) == 4, "retries do not duplicate comments");
        Check(await db.UserNotifications.CountAsync(n => n.TargetUrl == $"/social/posts/{first.PostId}") == 3, "retries do not duplicate notifications");
    }

    var retryArtifact = await CreateArtifact();
    await using (var db = CreateContext(new CommitFault(afterCommit: true)))
    {
        var result = (await Service(db).EnsureAsync(retryArtifact, creator, "建立後回應遺失"))!;
        Check(result.Created, "commit recovery preserves the created result");
        Check(await db.SocialPosts.CountAsync(p => p.ArtifactId == retryArtifact) == 1, "commit recovery does not duplicate the post");
        Check(await db.SocialComments.CountAsync(c => c.PostId == result.PostId) == 1, "commit recovery does not duplicate the initial comment");
    }

    var concurrentArtifact = await CreateArtifact();
    async Task<ArtifactDiscussionResult> CreateConcurrently(Guid user)
    {
        await using var db = CreateContext();
        return (await Service(db).EnsureAsync(concurrentArtifact, user, "同時建立"))!;
    }
    var concurrent = await Task.WhenAll(CreateConcurrently(creator), CreateConcurrently(commenter));
    await using (var db = CreateContext())
    {
        Check(concurrent[0].PostId == concurrent[1].PostId && concurrent.Count(result => result.Created) == 1, "concurrent requests share one canonical discussion");
        Check(await db.SocialPosts.CountAsync(p => p.ArtifactId == concurrentArtifact) == 1, "concurrency does not create duplicate posts");
        Check(await db.SocialComments.CountAsync(c => c.PostId == concurrent[0].PostId) == 2, "both concurrent users retain their comments");
    }

    await using (var db = CreateContext(new CommitFault(afterCommit: false, permanent: true)))
    {
        try
        {
            await Service(db).EnsureAsync(artifactId, commenter, "不得留下的留言");
            throw new Exception("Expected the permanent failure to block saving.");
        }
        catch (InvalidOperationException error) when (error.Message == "Injected rollback") { }
        Check(!await db.SocialComments.AnyAsync(c => c.Content == "不得留下的留言"), "failed transaction rolls back the comment");
        Check(await db.UserNotifications.CountAsync(n => n.TargetUrl == $"/social/posts/{first.PostId}") == 3, "failed transaction rolls back the notification");
    }
    await using (var db = CreateContext())
    {
        Check(await Service(db).EnsureAsync(Guid.NewGuid(), creator, "不存在的文物") is null, "missing artifact creates nothing");
    }
    var failedArtifact = await CreateArtifact();
    await using (var db = CreateContext(new CommitFault(afterCommit: false, permanent: true)))
    {
        try
        {
            await Service(db).EnsureAsync(failedArtifact, creator, "建立失敗");
            throw new Exception("Expected the permanent failure to block creation.");
        }
        catch (InvalidOperationException error) when (error.Message == "Injected rollback") { }
        Check(!await db.SocialPosts.AnyAsync(p => p.ArtifactId == failedArtifact), "failed creation leaves no empty post");
        Check(!await db.SocialComments.AnyAsync(c => c.Content == "建立失敗"), "failed creation leaves no orphaned initial comment");
    }
    Console.WriteLine("Artifact discussion SQL Server checks passed.");
}
finally
{
    SqlConnection.ClearAllPools();
    await ExecuteMaster($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE");
    await ExecuteMaster($"DROP DATABASE [{databaseName}]");
    Console.WriteLine("Removed isolated verification database.");
}

QmahDbContext CreateContext(IInterceptor? interceptor = null)
{
    var options = new DbContextOptionsBuilder<QmahDbContext>()
        .UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(2, TimeSpan.FromSeconds(1), null));
    if (interceptor is not null) options.AddInterceptors(interceptor);
    return new QmahDbContext(options.Options);
}
ArtifactDiscussionService Service(QmahDbContext db) => new(db, new SocialNotificationService(db));
async Task<Guid> CreateArtifact()
{
    var id = Guid.NewGuid();
    await using var db = CreateContext();
    await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [catalog].[Artifacts] ([Id], [Name], [IsActive]) VALUES ({id}, {"驗證文物"}, {true})");
    return id;
}
async Task ExecuteMaster(string sql)
{
    await using var command = new SqlCommand(sql, master);
    await command.ExecuteNonQueryAsync();
}
void Check(bool condition, string description)
{
    if (!condition) throw new Exception("FAILED: " + description);
    Console.WriteLine("PASS: " + description);
}

sealed class CommitFault(bool afterCommit, bool permanent = false) : DbTransactionInterceptor
{
    public bool Thrown { get; private set; }
    private void FailOnce()
    {
        if (Thrown) return;
        Thrown = true;
        if (permanent) throw new InvalidOperationException("Injected rollback");
        throw new TimeoutException("Injected transient commit failure");
    }
    public override ValueTask<InterceptionResult> TransactionCommittingAsync(
        DbTransaction transaction, TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
    {
        if (!afterCommit) FailOnce();
        return ValueTask.FromResult(result);
    }
    public override Task TransactionCommittedAsync(
        DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        if (afterCommit) FailOnce();
        return Task.CompletedTask;
    }
}
