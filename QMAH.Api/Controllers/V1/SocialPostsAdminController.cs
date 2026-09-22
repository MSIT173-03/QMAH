using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/admin/posts")]
[Authorize(Roles = "Admin")]
public sealed class SocialPostsAdminController(QmahDbContext db) : ApiControllerBase
{
    // 對應 database/Schema.sql 的 CK_SocialPosts_Status
    private static readonly HashSet<string> PostStatuses = ["PUBLISHED", "HIDDEN", "DELETED"];

    public sealed class UpdatePostStatusDto
    {
        public string Status { get; set; } = null!; // PUBLISHED, HIDDEN, DELETED
    }

    // GET /api/v1/admin/posts?status=&boardCode=&postType=&q=&from=&to=（都不帶就回傳全部貼文，不限狀態）
    [HttpGet]
    public async Task<ActionResult<ApiPage<AdminPostListItemDto>>> GetPosts(
        string? status,
        string? boardCode,
        string? postType,
        string? q,
        DateTime? from,
        DateTime? to,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.SocialPosts.AsNoTracking();

        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();
        if (normalizedStatus is not null && PostStatuses.Contains(normalizedStatus))
            query = query.Where(post => post.Status == normalizedStatus);

        if (!string.IsNullOrWhiteSpace(boardCode))
            query = query.Where(post => post.BoardCode == boardCode.Trim().ToUpperInvariant());

        if (!string.IsNullOrWhiteSpace(postType))
            query = query.Where(post => post.PostType == postType.Trim().ToUpperInvariant());

        var keyword = q?.Trim();
        if (!string.IsNullOrWhiteSpace(keyword))
            query = query.Where(post => post.Title.Contains(keyword) || post.Content.Contains(keyword));

        if (from.HasValue)
            query = query.Where(post => post.CreatedAt >= from.Value.Date);

        if (to.HasValue)
            query = query.Where(post => post.CreatedAt < to.Value.Date.AddDays(1));

        var projected = query
            .OrderByDescending(post => post.CreatedAt)
            .Select(post => new AdminPostListItemDto(
                post.Id,
                post.BoardCode,
                post.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == post.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                post.PostType,
                post.PublisherType,
                post.Title,
                post.Content.Length > 180 ? post.Content.Substring(0, 180) : post.Content,
                post.Status,
                post.SocialComments.Count(),
                post.CreatedAt,
                post.UpdatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    // 隱藏／還原／軟刪除貼文；活動貼文（PostType=EVENT）改由活動審核／發布狀態控管，不在這裡直接改。
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdatePostStatusDto dto, CancellationToken cancellationToken = default)
    {
        var status = dto.Status?.Trim().ToUpperInvariant();
        if (status is null || !PostStatuses.Contains(status))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "貼文狀態無效", detail: "Status 只能是 PUBLISHED、HIDDEN 或 DELETED。");

        var post = await db.SocialPosts.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (post is null)
            return MissingResource("找不到貼文", "這篇貼文不存在。");
        if (post.PostType == "EVENT")
            return InvalidWorkflow("活動貼文不可直接變更", "這篇貼文是活動的社群入口，請到活動管理調整審核／發布狀態。");

        post.Status = status;
        post.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "貼文狀態已更新", post.Id, post.Status });
    }
}
