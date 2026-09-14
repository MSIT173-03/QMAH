using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/admin/events")]
[Authorize(Roles = "Admin")]
public sealed class SocialEventsAdminController(
    QmahDbContext db,
    INotificationService notificationService) : ApiControllerBase
{
    private static readonly HashSet<string> ReviewStatuses = ["APPROVED", "REJECTED"];
    private static readonly HashSet<string> AllReviewStatuses = ["PENDING", "APPROVED", "REJECTED"];

    public sealed class ReviewEventDto
    {
        public string ReviewStatus { get; set; } = null!; // APPROVED, REJECTED
        public string? ReviewNote { get; set; }
    }

    // GET /api/v1/admin/events?reviewStatus=PENDING
    [HttpGet]
    public async Task<ActionResult<ApiPage<AdminEventListItemDto>>> GetEvents(
        string? reviewStatus = "PENDING",
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = string.IsNullOrWhiteSpace(reviewStatus) ? null : reviewStatus.Trim().ToUpperInvariant();

        var query = db.Events.AsNoTracking();
        if (normalizedStatus is not null && AllReviewStatuses.Contains(normalizedStatus))
            query = query.Where(item => item.ReviewStatus == normalizedStatus);

        var projected = query
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new AdminEventListItemDto(
                item.Id,
                item.EventType,
                item.OrganizerUserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == item.OrganizerUserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                item.Title,
                item.StartAt,
                item.EndAt,
                item.ReviewStatus,
                item.PublishStatus,
                item.ReviewNote,
                item.CreatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    [HttpPut("{id:guid}/review")]
    public async Task<IActionResult> ReviewEvent(Guid id, [FromBody] ReviewEventDto dto, CancellationToken cancellationToken = default)
    {
        var reviewStatus = dto.ReviewStatus?.Trim().ToUpperInvariant();
        if (reviewStatus is null || !ReviewStatuses.Contains(reviewStatus))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "審核狀態無效", detail: "ReviewStatus 只能是 APPROVED 或 REJECTED。");
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var eventItem = await db.Events
            .Include(e => e.SocialPost)
            .SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (eventItem is null)
            return MissingResource("找不到活動", "這場活動不存在。");

        var now = DateTime.UtcNow;
        eventItem.ReviewStatus = reviewStatus;
        eventItem.ReviewNote = string.IsNullOrWhiteSpace(dto.ReviewNote) ? null : dto.ReviewNote.Trim();
        eventItem.ReviewedByUserId = currentUserId;
        eventItem.ReviewedAt = now;
        // 通過審核就同步發布，退回則維持草稿，避免活動卡在「已核准但看不到」的狀態。
        eventItem.PublishStatus = reviewStatus == "APPROVED" ? "PUBLISHED" : "DRAFT";

        // 活動連結的社群貼文要跟著審核／發布狀態一起同步，否則貼文會一直停在 HIDDEN。
        if (eventItem.SocialPost is not null)
            EventSocialPostSynchronizer.SyncPublication(eventItem.SocialPost, eventItem, now);

        if (eventItem.OrganizerUserId.HasValue)
        {
            notificationService.QueueNotification(
                eventItem.OrganizerUserId.Value,
                reviewStatus == "APPROVED" ? "活動審核通過" : "活動審核未通過",
                reviewStatus == "APPROVED"
                    ? $"您發起的活動「{eventItem.Title}」已審核通過！"
                    : $"您發起的活動「{eventItem.Title}」未通過審核。原因：{eventItem.ReviewNote}",
                $"/events/{eventItem.Id}");
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "活動審核完成", eventItem.Id, eventItem.ReviewStatus, eventItem.PublishStatus });
    }
}
