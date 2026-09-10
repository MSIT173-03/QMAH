using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Data;
using System.Security.Claims;

namespace QMAH.API.Controllers.Client;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class UserNotificationsController : ControllerBase
{
    private readonly QmahDbContext _dbContext;

    public UserNotificationsController(QmahDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // GET /api/v1/notifications
    [HttpGet]
    public async Task<IActionResult> GetMyNotifications([FromQuery] bool? unreadOnly = false)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var query = _dbContext.UserNotifications
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
            .ToListAsync();

        return Ok(list);
    }

    // 標示單筆或全部已讀 API (可選擴充)
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var notification = await _dbContext.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null) return NotFound();

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "已標示為已讀" });
    }
}