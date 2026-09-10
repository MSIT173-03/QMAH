using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Application.Services;

public interface INotificationService
{
    Task SendNotificationAsync(Guid userId, string title, string content, string? targetUrl = null);
}

public class SocialNotificationService : INotificationService
{
    private readonly QmahDbContext _dbContext;

    public SocialNotificationService(QmahDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task SendNotificationAsync(Guid userId, string title, string content, string? targetUrl = null)
    {
        var notification = new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Content = content,
            TargetUrl = targetUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.UserNotifications.Add(notification);
        await _dbContext.SaveChangesAsync();
    }
}