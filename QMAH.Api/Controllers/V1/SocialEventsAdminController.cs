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
    private static readonly HashSet<string> AllPublishStatuses = ["DRAFT", "PUBLISHED", "CANCELLED"];

    public sealed class ReviewEventDto
    {
        public string ReviewStatus { get; set; } = null!; // APPROVED, REJECTED
        public string? ReviewNote { get; set; }
    }

    public sealed class SetPublishStatusDto
    {
        public string PublishStatus { get; set; } = null!; // DRAFT, PUBLISHED, CANCELLED
    }

    // GET /api/v1/admin/events?reviewStatus=&publishStatus=&q=（三個都不帶就回傳全部活動）
    [HttpGet]
    public async Task<ActionResult<ApiPage<AdminEventListItemDto>>> GetEvents(
        string? reviewStatus,
        string? publishStatus,
        string? q,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.Events.AsNoTracking();

        var normalizedReviewStatus = string.IsNullOrWhiteSpace(reviewStatus) ? null : reviewStatus.Trim().ToUpperInvariant();
        if (normalizedReviewStatus is not null && AllReviewStatuses.Contains(normalizedReviewStatus))
            query = query.Where(item => item.ReviewStatus == normalizedReviewStatus);

        var normalizedPublishStatus = string.IsNullOrWhiteSpace(publishStatus) ? null : publishStatus.Trim().ToUpperInvariant();
        if (normalizedPublishStatus is not null && AllPublishStatuses.Contains(normalizedPublishStatus))
            query = query.Where(item => item.PublishStatus == normalizedPublishStatus);

        var keyword = q?.Trim();
        if (!string.IsNullOrWhiteSpace(keyword))
            query = query.Where(item => item.Title.Contains(keyword) || item.Content.Contains(keyword));

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

    // 審核通過後，管理員可以直接切換發布狀態（例如活動辦完要下架、或先前取消後想恢復草稿）。
    [HttpPut("{id:guid}/publish-status")]
    public async Task<IActionResult> SetPublishStatus(Guid id, [FromBody] SetPublishStatusDto dto, CancellationToken cancellationToken = default)
    {
        var publishStatus = dto.PublishStatus?.Trim().ToUpperInvariant();
        if (publishStatus is null || !AllPublishStatuses.Contains(publishStatus))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "發布狀態無效", detail: "PublishStatus 只能是 DRAFT、PUBLISHED 或 CANCELLED。");

        var eventItem = await db.Events
            .Include(e => e.SocialPost)
            .SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (eventItem is null)
            return MissingResource("找不到活動", "這場活動不存在。");

        if (publishStatus == "PUBLISHED" && eventItem.ReviewStatus != "APPROVED")
            return InvalidWorkflow("尚未審核通過", "只有審核通過的活動才能發布。");

        eventItem.PublishStatus = publishStatus;
        if (eventItem.SocialPost is not null)
            EventSocialPostSynchronizer.SyncPublication(eventItem.SocialPost, eventItem, DateTime.UtcNow);

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "活動發布狀態已更新", eventItem.Id, eventItem.PublishStatus });
    }
}
