using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace QMAH.Infrastructure.Security;

/// <summary>Bound all in-flight work, including authentication database reads.</summary>
public sealed class QmahRequestAdmission : IAsyncDisposable
{
    private readonly PartitionedRateLimiter<HttpContext> limiter;

    public QmahRequestAdmission(IConfiguration configuration)
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
        limiter = new QueueWaitLimiter(
            PartitionedRateLimiter.CreateChained(areaLimiter, totalLimiter), TimeSpan.FromSeconds(waitSeconds));
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        using var lease = await limiter.AcquireAsync(context, 1, context.RequestAborted);
        if (lease.IsAcquired)
        {
            await next(context);
            return;
        }

        var timedOut = lease.TryGetMetadata("queue-timeout", out _);
        var status = timedOut ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status429TooManyRequests;
        context.Response.StatusCode = status;
        context.Response.Headers.RetryAfter = "2";
        await context.Response.WriteAsJsonAsync(new
        {
            status,
            code = timedOut ? "queue_timeout" : "overloaded",
            title = timedOut ? "等待逾時" : "目前訪客較多",
            detail = "此請求尚未開始執行，請稍後再試。"
        }, context.RequestAborted);
    }

    public ValueTask DisposeAsync() => limiter.DisposeAsync();

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
            || path.StartsWithSegments("/api/v1/metadata")
            || path.StartsWithSegments("/api/v1/me/catalog")
            || path.StartsWithSegments("/api/v1/keys")
            || path.StartsWithSegments("/api/v1/me/keys")) return "catalog";
        return "account";
    }
}
