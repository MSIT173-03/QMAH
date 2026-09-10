using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

using System.Security.Claims;

namespace QMAH.API.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/events")]
[Authorize(Roles = "Admin")]
public class AdminEventsController : ControllerBase
{
    private readonly QmahDbContext _dbContext;

    public AdminEventsController(QmahDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public class ReviewEventDto
    {
        public string ReviewStatus { get; set; } = null!; // APPROVED, REJECTED
        public string? ReviewNote { get; set; }
    }

    [HttpPut("{id}/review")]
    public async Task<IActionResult> ReviewEvent(Guid id, [FromBody] ReviewEventDto dto)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var eventItem = await _dbContext.Events
            .Include(e => e.OrganizerUser)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (eventItem == null)
            return NotFound(new { message = "找不到該活動" });

        eventItem.ReviewStatus = dto.ReviewStatus;
        eventItem.ReviewNote = dto.ReviewNote;
        eventItem.ReviewedByUserId = currentUserId;
        eventItem.ReviewedAt = DateTime.UtcNow;

        // 當審核通過時，同步發送通知給活動建立者
        if (eventItem.OrganizerUserId.HasValue)
        {
            var notification = new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = eventItem.OrganizerUserId.Value,
                Title = dto.ReviewStatus == "APPROVED" ? "活動審核通過" : "活動審核未通過",
                Content = dto.ReviewStatus == "APPROVED"
                    ? $"您發起的活動「{eventItem.Title}」已審核通過！"
                    : $"您發起的活動「{eventItem.Title}」未通過審核。原因：{dto.ReviewNote}",
                TargetUrl = $"/events/{eventItem.Id}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.UserNotifications.Add(notification);
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "活動審核完成", eventItem.Id, eventItem.ReviewStatus });
    }
}