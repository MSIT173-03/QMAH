using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/notifications")]
[Authorize]
public sealed class SocialNotificationsController(QmahDbContext db) : ApiControllerBase
{
    // GET /api/v1/notifications
    [HttpGet]
    public async Task<IActionResult> GetMyNotifications([FromQuery] bool? unreadOnly = false, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var query = db.UserNotifications
            .AsNoTracking()
            .Where(n => n.UserId == userId);

        if (unreadOnly == true)
            query = query.Where(n => !n.IsRead);

        var list = await query
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new
            {
                n.Id,
                n.Title,
                n.Content,
                n.TargetUrl,
                n.IsRead,
                n.CreatedAt,
                n.ReadAt
            })
            .ToListAsync(cancellationToken);

        return Ok(list);
    }

    // 標示單筆已讀
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var notification = await db.UserNotifications
            .SingleOrDefaultAsync(n => n.Id == id && n.UserId == userId, cancellationToken);
        if (notification is null)
            return MissingResource("找不到通知", "這則通知不存在或不屬於目前帳號。");

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "已標示為已讀" });
    }
}