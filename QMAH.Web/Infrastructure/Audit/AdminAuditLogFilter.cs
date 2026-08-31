using System.Security.Claims;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Mvc.Filters;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Infrastructure.Audit;

/// <summary>
/// 記錄後台管理操作的必要 metadata，不讀取或保存 request body。
/// </summary>
public sealed class AdminAuditLogFilter(
    IServiceScopeFactory scopeFactory,
    ILogger<AdminAuditLogFilter> logger) : IAsyncActionFilter
{
    private static readonly string[] AuditedRoles =
        ["Admin", "AnnouncementEditor", "ContentModerator", "EventModerator"];

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;
        if (context.HttpContext.User.Identity?.IsAuthenticated != true
            || HttpMethods.IsGet(request.Method)
            || HttpMethods.IsHead(request.Method)
            || HttpMethods.IsOptions(request.Method)
            || !AuditedRoles.Any(role => context.HttpContext.User.IsInRole(role)))
        {
            await next();
            return;
        }

        ActionExecutedContext? executed = null;
        try
        {
            executed = await next();
        }
        catch
        {
            await TryWriteAsync(context, StatusCodes.Status500InternalServerError);
            throw;
        }

        await TryWriteAsync(
            context,
            executed.HttpContext.Response.StatusCode is 0
                ? StatusCodes.Status200OK
                : executed.HttpContext.Response.StatusCode);
    }

    private async Task TryWriteAsync(ActionExecutingContext context, int statusCode)
    {
        try
        {
            // 使用獨立 scope 與 DbContext，避免失敗的管理操作留下的 tracked entity
            // 被稽核紀錄的 SaveChanges 一起寫入資料庫。
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
            var routeValues = context.RouteData.Values;
            var actorUserId = Guid.TryParse(
                context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier),
                out var parsedUserId)
                ? parsedUserId
                : (Guid?)null;

            db.AuditLogs.Add(new AdminAuditLog
            {
                ActorUserId = actorUserId,
                Area = Limit(routeValues["area"]?.ToString() ?? "Root", 40),
                Controller = Limit(routeValues["controller"]?.ToString() ?? "Unknown", 100),
                Action = Limit(routeValues["action"]?.ToString() ?? "Unknown", 100),
                HttpMethod = Limit(context.HttpContext.Request.Method, 10),
                RequestPath = Limit(context.HttpContext.Request.Path.Value ?? "/", 400),
                ResultStatusCode = Math.Clamp(statusCode, 100, 599),
                Detail = BuildDetail(context, statusCode),
                OccurredAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception exception)
        {
            // 稽核資料庫暫時不可用時，不得讓原本的管理操作失敗。
            logger.LogError(exception, "寫入後台稽核紀錄失敗。Url：{RequestPath}", context.HttpContext.Request.Path);
        }
    }

    private static string BuildDetail(ActionExecutingContext context, int statusCode)
    {
        var result = statusCode is >= 200 and < 400
            ? "管理操作完成"
            : "管理操作未完成";
        var targetId = FindTargetId(context);

        return targetId is null
            ? result
            : $"{result}；目標識別碼：{targetId:D}";
    }

    private static Guid? FindTargetId(ActionExecutingContext context)
    {
        if (context.RouteData.Values.TryGetValue("id", out var routeId)
            && routeId is not null
            && Guid.TryParse(routeId.ToString(), out var parsedRouteId)
            && parsedRouteId != Guid.Empty)
        {
            return parsedRouteId;
        }

        foreach (var argument in context.ActionArguments)
        {
            if (!string.Equals(argument.Key, "id", StringComparison.OrdinalIgnoreCase)
                && !argument.Key.EndsWith("Id", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (argument.Value is Guid guid && guid != Guid.Empty)
                return guid;
        }

        return null;
    }

    private static string Limit(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
