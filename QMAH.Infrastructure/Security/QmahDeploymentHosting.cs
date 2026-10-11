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
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var local = context.Connection.RemoteIpAddress is { } address && IPAddress.IsLoopback(address);
                    if (local || context.WebSockets.IsWebSocketRequest || context.Request.Path.StartsWithSegments("/hubs")
                        || context.Request.Path.StartsWithSegments("/images") || context.Request.Path.StartsWithSegments("/fonts"))
                        return RateLimitPartition.GetNoLimiter("health-and-streams");
                    return RateLimitPartition.GetConcurrencyLimiter("application-http", _ => new ConcurrencyLimiterOptions
                    {
                        PermitLimit = permits,
                        QueueLimit = queue,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    });
                });
                var originalHandler = options.OnRejected;
                options.OnRejected = async (context, token) =>
                {
                    if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    {
                        context.HttpContext.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                        if (originalHandler is not null) { await originalHandler(context, token); return; }
                    }
                    else context.HttpContext.Response.Headers.RetryAfter = "2";
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new { status = 429, title = "目前訪客較多", detail = "請稍候再試，資料與訂單不受影響。" }, token);
                };
            });
        }

        return services;
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
