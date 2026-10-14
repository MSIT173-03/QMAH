using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace QMAH.Infrastructure.Security;

/// <summary>部署時才啟用代理與路徑設定，既有本機入口維持原行為。</summary>
public static class QmahDeploymentHosting
{
    public static IServiceCollection AddQmahDeploymentHosting(
        this IServiceCollection services, IConfiguration configuration)
    {
        var keysPath = configuration["DataProtection:KeysPath"];
        if (!string.IsNullOrWhiteSpace(keysPath))
        {
            services.AddDataProtection()
                .SetApplicationName(QmahSharedAuthentication.DataProtectionApplicationName)
                .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        }

        if (configuration.GetValue<bool>("Hosting:ForwardedHeadersEnabled"))
        {
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                options.ForwardLimit = 1;
                // 部署腳本將反向代理與 Kestrel 放在同一主機，只信任 loopback。
                options.KnownProxies.Add(IPAddress.Loopback);
            });
        }

        if (configuration.GetValue<bool>("Hosting:StabilityLimitsEnabled"))
        {
            services.PostConfigure<RateLimiterOptions>(options =>
            {
                var permits = Math.Clamp(configuration.GetValue("Hosting:MaxConcurrentRequests", 48), 4, 256);
                var queue = Math.Clamp(configuration.GetValue("Hosting:MaxQueuedRequests", 48), 0, 128);
                var areaPermits = Math.Max(1, permits / 3);
                var areaQueue = queue == 0 ? 0 : Math.Max(1, queue / 3);
                var areaLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    if (BypassStabilityLimit(context) || !context.Request.Path.StartsWithSegments("/api"))
                        return RateLimitPartition.GetNoLimiter("health-and-non-api");
                    var area = ApiArea(context.Request.Path);
                    return RateLimitPartition.GetConcurrencyLimiter(area, _ => new ConcurrencyLimiterOptions
                    {
                        PermitLimit = areaPermits,
                        // 短暫尖峰先在功能區排隊，等待時不占住全站名額；佇列有界。
                        QueueLimit = areaQueue,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    });
                });
                var totalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    if (BypassStabilityLimit(context))
                        return RateLimitPartition.GetNoLimiter("health-and-streams");
                    return RateLimitPartition.GetConcurrencyLimiter("application-http", _ => new ConcurrencyLimiterOptions
                    {
                        PermitLimit = permits,
                        QueueLimit = queue,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    });
                });
                // 先做功能區隔離，再套既有總量限制，總並行與佇列上限不增加。
                var waitSeconds = Math.Clamp(configuration.GetValue("Hosting:MaxQueueWaitSeconds", 10), 1, 30);
                options.GlobalLimiter = new QueueWaitLimiter(
                    PartitionedRateLimiter.CreateChained(areaLimiter, totalLimiter), TimeSpan.FromSeconds(waitSeconds));
                var originalHandler = options.OnRejected;
                options.OnRejected = async (context, token) =>
                {
                    if (context.Lease.TryGetMetadata("queue-timeout", out _))
                    {
                        context.HttpContext.Response.Headers.RetryAfter = "2";
                        context.HttpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                        await context.HttpContext.Response.WriteAsJsonAsync(new { status = 503, code = "queue_timeout", title = "等待逾時", detail = "等待逾時，請重新整理或稍後再嘗試。此請求尚未開始執行。" }, token);
                        return;
                    }
                    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    {
                        context.HttpContext.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                        if (originalHandler is not null) { await originalHandler(context, token); return; }
                    }
                    else context.HttpContext.Response.Headers.RetryAfter = "2";
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new { status = 429, title = "目前訪客較多", detail = "等待人數較多，請重新整理或稍後再嘗試。此請求尚未開始執行。" }, token);
                };
            });
        }

        return services;
    }

    // 僅限制取得名額前的等待，不為已開始的交易設定取消期限。
    private sealed class QueueWaitLimiter(PartitionedRateLimiter<HttpContext> inner, TimeSpan wait)
        : PartitionedRateLimiter<HttpContext>
    {
        public override RateLimiterStatistics? GetStatistics(HttpContext resource) => inner.GetStatistics(resource);
        protected override RateLimitLease AttemptAcquireCore(HttpContext resource, int permitCount)
            => inner.AttemptAcquire(resource, permitCount);
        protected override async ValueTask<RateLimitLease> AcquireAsyncCore(HttpContext resource, int permitCount, CancellationToken cancellationToken)
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            deadline.CancelAfter(wait);
            try { return await inner.AcquireAsync(resource, permitCount, deadline.Token); }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && deadline.IsCancellationRequested)
            { return new QueueTimeoutLease(); }
        }
        protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); }
        protected override ValueTask DisposeAsyncCore() => inner.DisposeAsync();
    }

    private sealed class QueueTimeoutLease : RateLimitLease
    {
        public override bool IsAcquired => false;
        public override IEnumerable<string> MetadataNames => ["queue-timeout"];
        public override bool TryGetMetadata(string metadataName, out object? metadata)
        { metadata = metadataName == "queue-timeout" ? true : null; return metadata is not null; }
    }

    private static bool BypassStabilityLimit(HttpContext context) =>
        (context.Connection.RemoteIpAddress is { } address && IPAddress.IsLoopback(address))
        || context.WebSockets.IsWebSocketRequest
        || context.Request.Path.StartsWithSegments("/hubs")
        || context.Request.Path.StartsWithSegments("/images")
        || context.Request.Path.StartsWithSegments("/fonts");

    private static string ApiArea(PathString path)
    {
        if (path.StartsWithSegments("/api/v1/game")) return "game";
        if (path.StartsWithSegments("/api/v1/social")) return "social";
        if (path.StartsWithSegments("/api/v1/store")
            || path.StartsWithSegments("/api/v1/me/cart")
            || path.StartsWithSegments("/api/v1/me/orders")
            || path.StartsWithSegments("/api/v1/me/coupons")
            || path.StartsWithSegments("/api/v1/me/addresses")) return "store";
        if (path.StartsWithSegments("/api/v1/catalog")
            || path.StartsWithSegments("/api/v1/me/catalog")
            || path.StartsWithSegments("/api/v1/keys")
            || path.StartsWithSegments("/api/v1/me/keys")) return "catalog";
        return "account";
    }

    public static IApplicationBuilder UseQmahDeploymentHosting(
        this IApplicationBuilder app, IConfiguration configuration)
    {
        if (configuration.GetValue<bool>("Hosting:ForwardedHeadersEnabled"))
        {
            app.UseForwardedHeaders();
        }

        var pathBase = configuration["Hosting:PathBase"];
        if (!string.IsNullOrWhiteSpace(pathBase))
        {
            if (!pathBase.StartsWith('/') || pathBase.EndsWith('/') || pathBase.Contains(".."))
            {
                throw new InvalidOperationException("Hosting:PathBase 必須是 /admin 這類不含尾斜線的絕對路徑。");
            }
            app.UsePathBase(new PathString(pathBase));
        }

        if (configuration.GetValue<bool>("Hosting:SecurityHeadersEnabled"))
        {
            app.Use(async (context, next) =>
            {
                context.Response.Headers.TryAdd("X-Content-Type-Options", "nosniff");
                context.Response.Headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
                context.Response.Headers.TryAdd("Content-Security-Policy", "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
                await next(context);
            });
        }

        return app;
    }
}
