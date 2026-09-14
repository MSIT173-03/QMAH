using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/admin/comments")]
[Authorize(Roles = "Admin")]
public sealed class SocialCommentsAdminController(QmahDbContext db) : ApiControllerBase
{
    // 對應 database/Schema.sql 的 CK_SocialComments_Status
    private static readonly HashSet<string> CommentStatuses = ["PUBLISHED", "HIDDEN", "DELETED"];

    public sealed class UpdateCommentStatusDto
    {
        public string Status { get; set; } = null!; // PUBLISHED, HIDDEN, DELETED
    }

    // GET /api/v1/admin/comments?status=&postId=&q=（都不帶就回傳全部留言，不限狀態）
    [HttpGet]
    public async Task<ActionResult<ApiPage<AdminCommentListItemDto>>> GetComments(
        string? status,
        Guid? postId,
        string? q,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.SocialComments.AsNoTracking();

        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();
        if (normalizedStatus is not null && CommentStatuses.Contains(normalizedStatus))
            query = query.Where(comment => comment.Status == normalizedStatus);

        if (postId.HasValue)
            query = query.Where(comment => comment.PostId == postId.Value);

        var keyword = q?.Trim();
        if (!string.IsNullOrWhiteSpace(keyword))
            query = query.Where(comment => comment.Content.Contains(keyword));

        var projected = query
            .OrderByDescending(comment => comment.CreatedAt)
            .Select(comment => new AdminCommentListItemDto(
                comment.Id,
                comment.PostId,
                db.SocialPosts
                    .Where(post => post.Id == comment.PostId)
                    .Select(post => post.Title)
                    .FirstOrDefault() ?? "（貼文已刪除）",
                comment.ParentCommentId,
                comment.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == comment.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                comment.Content,
                comment.Status,
                comment.CreatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    // 隱藏／還原／軟刪除留言
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateCommentStatusDto dto, CancellationToken cancellationToken = default)
    {
        var status = dto.Status?.Trim().ToUpperInvariant();
        if (status is null || !CommentStatuses.Contains(status))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "留言狀態無效", detail: "Status 只能是 PUBLISHED、HIDDEN 或 DELETED。");

        var comment = await db.SocialComments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (comment is null)
            return MissingResource("找不到留言", "這則留言不存在。");

        comment.Status = status;
        comment.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "留言狀態已更新", comment.Id, comment.Status });
    }
}
