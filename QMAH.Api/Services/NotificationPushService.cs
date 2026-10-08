using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QMAH.Api.Hubs;
using QMAH.Infrastructure.Data;

namespace QMAH.Api.Services;

/// <summary>集中偵測已提交的通知，涵蓋 API 與獨立後台；不參與遊戲請求或交易。</summary>
public sealed class NotificationPushService(
    IServiceScopeFactory scopes,
    NotificationConnections connections,
    IHubContext<NotificationHub> hub,
    ILogger<NotificationPushService> logger) : BackgroundService
{
    private sealed record Stamp(int Count, int Unread, DateTime Created, DateTime? Read);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var previous = new Dictionary<Guid, Stamp>();
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeSpan.FromSeconds(2);
            try
            {
                var users = connections.Users;
                foreach (var id in previous.Keys.Except(users).ToArray()) previous.Remove(id);
                if (users.Length > 0)
                {
                    using var scope = scopes.CreateScope();
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    timeout.CancelAfter(TimeSpan.FromSeconds(3));
                    var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
                    db.Database.SetCommandTimeout(3);
                    var current = await db.UserNotifications.AsNoTracking()
                        .Where(item => users.Contains(item.UserId))
                        .GroupBy(item => item.UserId)
                        .Select(group => new
                        {
                            UserId = group.Key,
                            Count = group.Count(),
                            Unread = group.Count(item => !item.IsRead),
                            Created = group.Max(item => item.CreatedAt),
                            Read = group.Max(item => item.ReadAt)
                        }).ToListAsync(timeout.Token);
                    var stamps = current.ToDictionary(item => item.UserId,
                        item => new Stamp(item.Count, item.Unread, item.Created, item.Read));
                    foreach (var userId in users)
                    {
                        var stamp = stamps.GetValueOrDefault(userId) ?? new Stamp(0, 0, DateTime.MinValue, null);
                        if (!previous.TryGetValue(userId, out var old) || old != stamp)
                        {
                            await hub.Clients.User(userId.ToString()).SendAsync("NotificationsChanged", timeout.Token);
                            previous[userId] = stamp;
                        }
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "通知推送暫時無法更新，稍後重試。");
                delay = TimeSpan.FromSeconds(15);
            }
            try { await Task.Delay(delay, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
