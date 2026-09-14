using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/admin/reports")]
[Authorize(Roles = "Admin")]
public sealed class SocialReportsAdminController(
    QmahDbContext db,
    INotificationService notificationService) : ApiControllerBase
{
    // 對應 database/Schema.sql 的 CK_ContentReports_Status；沒有 DISMISSED 這個值。
    private static readonly HashSet<string> ReportStatuses = ["PENDING", "RESOLVED", "REJECTED"];
    private static readonly HashSet<string> ContentActions = ["HIDDEN", "DELETED"];

    public sealed class UpdateReportDto
    {
        public string Status { get; set; } = null!; // PENDING, RESOLVED, REJECTED
        public string? Resolution { get; set; }
        public string? ContentAction { get; set; } // HIDDEN, DELETED（針對違規內容）
    }

    // 取得檢舉列表
    [HttpGet]
    public async Task<ActionResult<ApiPage<AdminContentReportDto>>> GetReports(
        string? status = "PENDING",
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.ContentReports.AsNoTracking();

        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();
        if (normalizedStatus is not null && ReportStatuses.Contains(normalizedStatus))
            query = query.Where(r => r.Status == normalizedStatus);

        var projected = query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminContentReportDto(
                r.Id,
                r.TargetType,
                r.TargetId,
                r.Reason,
                r.Detail,
                r.Status,
                r.Resolution,
                r.ReporterUserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == r.ReporterUserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                r.CreatedAt,
                r.ReviewedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    // 審核檢舉並處理違規內容
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> ReviewReport(Guid id, [FromBody] UpdateReportDto dto, CancellationToken cancellationToken = default)
    {
        var status = dto.Status?.Trim().ToUpperInvariant();
        if (status is null || !ReportStatuses.Contains(status))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "檢舉狀態無效", detail: "Status 只能是 PENDING、RESOLVED 或 REJECTED。");
        if (dto.ContentAction is not null && !ContentActions.Contains(dto.ContentAction.Trim().ToUpperInvariant()))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "內容處理動作無效", detail: "ContentAction 只能是 HIDDEN 或 DELETED。");
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var report = await db.ContentReports.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (report is null)
            return MissingResource("找不到該檢舉單", "這筆檢舉不存在。");

        report.Status = status;
        report.Resolution = string.IsNullOrWhiteSpace(dto.Resolution) ? null : dto.Resolution.Trim();
        report.ReviewedByUserId = currentUserId;
        report.ReviewedAt = DateTime.UtcNow;

        // 若確認違規 (RESOLVED) 且有指定動作，處理對應內容
        if (status == "RESOLVED" && !string.IsNullOrEmpty(dto.ContentAction))
        {
            var contentAction = dto.ContentAction.Trim().ToUpperInvariant();
            if (report.TargetType == "POST")
            {
                var post = await db.SocialPosts.SingleOrDefaultAsync(p => p.Id == report.TargetId, cancellationToken);
                if (post is not null)
                {
                    post.Status = contentAction;
                    post.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (report.TargetType == "COMMENT")
            {
                var comment = await db.SocialComments.SingleOrDefaultAsync(c => c.Id == report.TargetId, cancellationToken);
                if (comment is not null)
                {
                    comment.Status = contentAction;
                    comment.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        // 通知檢舉人審核結果，讓對方知道回報已被處理
        notificationService.QueueNotification(
            report.ReporterUserId,
            status == "RESOLVED" ? "檢舉已處理" : "檢舉審核結果",
            status == "RESOLVED"
                ? "您的檢舉已確認成立，違規內容已依規則處理。"
                : status == "REJECTED"
                    ? "您的檢舉經審核後未成立。"
                    : "您的檢舉已重新列入待處理。",
            null);

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "檢舉處理完畢", report.Id, report.Status });
    }
}
