using System.Data.Common;
using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Verification;

internal sealed class IsolatedApi : WebApplicationFactory<global::Program>
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "qmah-api-check-" + Guid.NewGuid().ToString("N"));
    private readonly Dictionary<string, string?> previousEnvironment = new();
    public QueryCounter Queries { get; } = new();
    public ApplicationUser[] Members { get; } = [
        new() { Id = Guid.NewGuid(), UserName = "synthetic-one", Email = "one@example.invalid", EmailConfirmed = true, SecurityStamp = Guid.NewGuid().ToString() },
        new() { Id = Guid.NewGuid(), UserName = "synthetic-two", Email = "two@example.invalid", EmailConfirmed = true, SecurityStamp = Guid.NewGuid().ToString() }
    ];

    public IsolatedApi(bool withAdmission = false)
    {
        Directory.CreateDirectory(root);
        // Program resolves its database before ConfigureTestServices runs. Set
        // process-scoped configuration BEFORE the entry point can execute, so
        // automatic discovery never probes any existing SQL Server instance.
        var settings = new Dictionary<string, string?>
        {
            ["ASPNETCORE_ENVIRONMENT"] = "Verification",
            ["ASPNETCORE_CONTENTROOT"] = root,
            ["QmahDatabaseDiscovery__Enabled"] = "false",
            ["ConnectionStrings__QmahDatabase"] = "Server=unused.invalid;Database=unused;Integrated Security=True;Connect Timeout=1",
            ["Media__AssetRootPath"] = Path.Combine(root, "media"),
            ["Hosting__SecurityHeadersEnabled"] = "true",
            ["Hosting__StabilityLimitsEnabled"] = withAdmission ? "true" : "false",
            ["Hosting__MaxConcurrentRequests"] = "6",
            ["Hosting__MaxQueuedRequests"] = "0",
            ["Hosting__ForwardedHeadersEnabled"] = "true",
            ["Cors__AllowedOrigins__0"] = "http://localhost:4200",
            ["Ecpay__MerchantId"] = "verification-only",
            ["Ecpay__HashKey"] = "synthetic-not-a-payment-key",
            ["Ecpay__HashIv"] = "synthetic-not-a-payment-iv",
            ["Ecpay__CheckoutUrl"] = "https://payments.example.invalid/checkout",
            ["Ecpay__QueryTradeInfoUrl"] = "https://payments.example.invalid/query",
            ["Ecpay__PublicBaseUrl"] = "https://api.example.invalid",
            ["Ecpay__ClientBaseUrl"] = "https://client.example.invalid"
        };
        foreach (var (name, value) in settings)
        {
            previousEnvironment[name] = Environment.GetEnvironmentVariable(name);
            Environment.SetEnvironmentVariable(name, value);
        }
        using var connection = new SqliteConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE ArtifactCategories (Id TEXT PRIMARY KEY, Code TEXT NOT NULL, Name TEXT NOT NULL);
            CREATE TABLE EraBuckets (Id TEXT PRIMARY KEY, Code TEXT NOT NULL, Name TEXT NOT NULL, StartYear INTEGER, EndYear INTEGER);
            INSERT INTO ArtifactCategories VALUES ('11111111-1111-1111-1111-111111111111', 'A', 'Synthetic A');
            INSERT INTO ArtifactCategories VALUES ('22222222-2222-2222-2222-222222222222', 'B', 'Synthetic B');
            INSERT INTO EraBuckets VALUES ('33333333-3333-3333-3333-333333333333', 'EARLY', 'Synthetic early', 100, 200);
            INSERT INTO EraBuckets VALUES ('44444444-4444-4444-4444-444444444444', 'LATE', 'Synthetic late', 300, 400);
            """;
        command.ExecuteNonQuery();
        using (var db = new QmahDbContext(new DbContextOptionsBuilder<QmahDbContext>().UseSqlite(ConnectionString).Options))
        {
            var identitySchema = Regex.Replace(db.Database.GenerateCreateScript(), @"\(max\)", "", RegexOptions.IgnoreCase)
                .Replace("(sysutcdatetime())", "CURRENT_TIMESTAMP");
            foreach (var statement in Regex.Split(identitySchema, @";\r?\n")
                         .Where(sql => sql.TrimStart().StartsWith("CREATE TABLE \"AspNet", StringComparison.Ordinal)))
            {
                using var create = connection.CreateCommand();
                create.CommandText = statement;
                create.ExecuteNonQuery();
            }
            db.Users.AddRange(Members);
            db.SaveChanges();
        }
        // Real TCP requests, bound only to loopback. No target URL is accepted.
        UseKestrel(options => options.Listen(IPAddress.Loopback, 0));
    }

    private string ConnectionString => new SqliteConnectionStringBuilder { DataSource = Path.Combine(root, "synthetic.sqlite") }.ToString();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Verification");
        builder.UseContentRoot(root);
        builder.ConfigureLogging(logging => logging.ClearProviders().AddSimpleConsole().SetMinimumLevel(LogLevel.Warning));
        builder.ConfigureTestServices(services =>
        {
            // Disable only application background workers: none may write data,
            // send messages, or contact external moderation/payment services.
            foreach (var service in services.Where(s => s.ServiceType == typeof(IHostedService)
                         && s.ImplementationType?.Namespace == "QMAH.Api.Services").ToArray())
                services.Remove(service);
            services.RemoveAll<DbContextOptions<QmahDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<QmahDbContext>>();
            services.AddDbContext<QmahDbContext>(options => options.UseSqlite(ConnectionString).AddInterceptors(Queries));
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
        });
    }

    public HttpClient OpenClient()
    {
        var address = Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        var uri = new Uri(address);
        if (!uri.IsLoopback) throw new InvalidOperationException("Verification must never target a remote service.");
        var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })
        {
            BaseAddress = uri,
            Timeout = TimeSpan.FromSeconds(15)
        };
        // Match the production loopback reverse proxy's HTTPS termination.
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.50");
        return client;
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        SqliteConnection.ClearAllPools();
        Directory.Delete(root, recursive: true);
        foreach (var (name, value) in previousEnvironment)
            Environment.SetEnvironmentVariable(name, value);
    }
}

internal sealed class QueryCounter : DbCommandInterceptor
{
    private long count;
    public bool HoldReads { get; set; }
    public TaskCompletionSource TwoReadsStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource ReleaseReads { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public long Count => Interlocked.Read(ref count);
    public void Reset() => Interlocked.Exchange(ref count, 0);
    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        var current = Interlocked.Increment(ref count);
        if (HoldReads)
        {
            if (current >= 2) TwoReadsStarted.TrySetResult();
            await ReleaseReads.Task.WaitAsync(cancellationToken);
        }
        return result;
    }
}
