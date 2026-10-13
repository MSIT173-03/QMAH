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
    SocialUpdateConnections socialConnections,
    IHubContext<SocialUpdateHub> socialHub,
    ILogger<NotificationPushService> logger) : BackgroundService
{
    private sealed record Stamp(int Count, int Unread, DateTime Created, DateTime? Read);
    private sealed record EconomyStamp(int Points, decimal KeyProgress, DateTime? PointUpdated, DateTime? ProgressUpdated);
    private sealed record SocialStamp(int Posts, DateTime? LatestPostUpdate, int Comments, DateTime? LatestCommentUpdate, int Events, int EventDetailsHash);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var previous = new Dictionary<Guid, Stamp>();
        var previousEconomy = new Dictionary<Guid, EconomyStamp>();
        SocialStamp? previousSocial = null;
        var nextSocialCheck = DateTime.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeSpan.FromSeconds(2);
            try
            {
                var users = connections.Users;
                foreach (var id in previous.Keys.Except(users).ToArray()) previous.Remove(id);
                foreach (var id in previousEconomy.Keys.Except(users).ToArray()) previousEconomy.Remove(id);
                if (users.Length > 0 || socialConnections.HasConnections)
                {
                    using var scope = scopes.CreateScope();
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    timeout.CancelAfter(TimeSpan.FromSeconds(5));
                    var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
                    db.Database.SetCommandTimeout(5);
                    if (users.Length > 0)
                    {
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

                    var points = await db.PointBalances.AsNoTracking()
                        .Where(item => users.Contains(item.UserId))
                        .Select(item => new { item.UserId, item.Balance, item.UpdatedAt })
                        .ToDictionaryAsync(item => item.UserId, timeout.Token);
                    var progress = await db.KeyProgressBalances.AsNoTracking()
                        .Where(item => users.Contains(item.UserId))
                        .Select(item => new { item.UserId, item.Balance, item.UpdatedAt })
                        .ToDictionaryAsync(item => item.UserId, timeout.Token);
                    foreach (var userId in users)
                    {
                        var point = points.GetValueOrDefault(userId);
                        var keyProgress = progress.GetValueOrDefault(userId);
                        var stamp = new EconomyStamp(point?.Balance ?? 0, keyProgress?.Balance ?? 0,
                            point?.UpdatedAt, keyProgress?.UpdatedAt);
                        if (!previousEconomy.TryGetValue(userId, out var old) || old != stamp)
                        {
                            await hub.Clients.User(userId.ToString()).SendAsync("EconomyChanged", timeout.Token);
                            previousEconomy[userId] = stamp;
                        }
                    }
                    }

                    if (socialConnections.HasConnections && DateTime.UtcNow >= nextSocialCheck)
                    {
                        nextSocialCheck = DateTime.UtcNow.AddSeconds(5);
                        var publicPosts = db.SocialPosts.AsNoTracking()
                            .Where(item => item.Status == "PUBLISHED" && item.PublisherType == "COMMUNITY" && item.PostType == "POST");
                        var postStamp = await publicPosts.GroupBy(_ => 1)
                            .Select(group => new { Count = group.Count(), Latest = group.Max(item => (DateTime?)item.UpdatedAt) })
                            .SingleOrDefaultAsync(timeout.Token);
                        var commentStamp = await db.SocialComments.AsNoTracking()
                            .Where(item => item.Status == "PUBLISHED")
                            .GroupBy(_ => 1)
                            .Select(group => new { Count = group.Count(), Latest = group.Max(item => (DateTime?)item.UpdatedAt) })
                            .SingleOrDefaultAsync(timeout.Token);
                        var events = await db.Events.AsNoTracking()
                            .Where(item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED")
                            .OrderBy(item => item.Id)
                            .Select(item => new
                            {
                                item.Id,
                                item.Title,
                                item.Location,
                                item.StartAt,
                                item.EndAt,
                                Active = item.EventRegistrations.Count(registration =>
                                    registration.Status == "REGISTERED" || registration.Status == "ATTENDED"),
                                LatestRegistration = item.EventRegistrations.Max(registration => (DateTime?)registration.RegisteredAt)
                            }).ToListAsync(timeout.Token);
                        var eventHash = new HashCode();
                        foreach (var item in events)
                        {
                            eventHash.Add(item.Id);
                            eventHash.Add(item.Title, StringComparer.Ordinal);
                            eventHash.Add(item.Location, StringComparer.Ordinal);
                            eventHash.Add(item.StartAt);
                            eventHash.Add(item.EndAt);
                            eventHash.Add(item.Active);
                            eventHash.Add(item.LatestRegistration);
                        }
                        var stamp = new SocialStamp(postStamp?.Count ?? 0, postStamp?.Latest,
                            commentStamp?.Count ?? 0, commentStamp?.Latest, events.Count,
                            eventHash.ToHashCode());
                        if (previousSocial != stamp)
                        {
                            await socialHub.Clients.All.SendAsync("SocialChanged", timeout.Token);
                            previousSocial = stamp;
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
