using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace QMAH.Api.Services;

public static class QmahApiRateLimiting
{
    public static IServiceCollection AddQmahApiRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
                    context.HttpContext.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retry.TotalSeconds)).ToString();
                var isAuth = context.HttpContext.Request.Path.StartsWithSegments("/api/v1/account");
                await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = isAuth ? "登入嘗試過於頻繁" : "操作過於頻繁",
                    Detail = isAuth ? "請稍後再試。" : "發文/留言速度過快，請稍後再試。"
                }, options: null, contentType: "application/problem+json", cancellationToken: token);
            };
            options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                Address(context), _ => Window(30, TimeSpan.FromMinutes(1))));
            // The two verification email endpoints must share the same IP quota.
            options.AddPolicy("verificationEmail", context => RateLimitPartition.GetFixedWindowLimiter(
                Address(context), _ => Window(3, TimeSpan.FromMinutes(5))));
            options.AddPolicy("socialContent", context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Address(context),
                _ => Window(10, TimeSpan.FromMinutes(1))));
        });

    private static string Address(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    private static FixedWindowRateLimiterOptions Window(int permits, TimeSpan duration) => new()
    {
        PermitLimit = permits, Window = duration, QueueLimit = 0, AutoReplenishment = true
    };
}
