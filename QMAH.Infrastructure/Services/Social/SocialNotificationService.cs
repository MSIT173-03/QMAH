using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Social;

public interface INotificationService
{
    /// <summary>
    /// 建立一筆站內通知並加入目前 DbContext 的追蹤清單。
    /// 不會呼叫 SaveChangesAsync：由呼叫端在同一次 request 的 SaveChangesAsync 一併寫入，
    /// 確保通知與觸發通知的異動（審核、檢舉處理等）在同一個交易內一起成功或一起失敗。
    /// </summary>
    void QueueNotification(Guid userId, string title, string content, string? targetUrl = null);
}

public sealed class SocialNotificationService(QmahDbContext db) : INotificationService
{
    public void QueueNotification(Guid userId, string title, string content, string? targetUrl = null)
    {
        db.UserNotifications.Add(new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Content = content,
            TargetUrl = targetUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
    }
}
