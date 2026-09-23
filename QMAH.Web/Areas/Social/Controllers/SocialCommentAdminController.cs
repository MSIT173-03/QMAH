using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Infrastructure;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AdminNavigation("留言管理", 35)]
[Authorize(Policy = "Policy.Social.ManageReports")]
public sealed class SocialCommentAdminController : Controller
{
    private static readonly int[] PageSizes = [10, 20, 50, 100];
    private static readonly HashSet<string> AllowedStatuses = ["PUBLISHED", "HIDDEN", "DELETED"];

    private readonly QmahDbContext _context;

    public SocialCommentAdminController(QmahDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public Task<IActionResult> Index(
        [FromQuery] CommentAdminPageViewModel filter,
        CancellationToken cancellationToken = default) =>
        Comments(filter, cancellationToken);

    // 列表在資料庫完成篩選、計數、排序與分頁，只投影本頁需要的欄位
    // GET: /Social/SocialCommentAdmin/Comments
    [HttpGet]
    public async Task<IActionResult> Comments(
        [FromQuery] CommentAdminPageViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Status = string.IsNullOrWhiteSpace(filter.Status) ? null : filter.Status.Trim().ToUpperInvariant();
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();
        filter.Page = Math.Max(1, filter.Page);
        filter.PageSize = PageSizes.Contains(filter.PageSize) ? filter.PageSize : 20;

        var query = _context.SocialComments.AsNoTracking();

        if (filter.Status is not null && AllowedStatuses.Contains(filter.Status))
        {
            query = query.Where(comment => comment.Status == filter.Status);
        }

        if (filter.PostId.HasValue)
        {
            query = query.Where(comment => comment.PostId == filter.PostId.Value);
        }

        if (filter.Keyword is not null)
        {
            query = query.Where(comment => comment.Content.Contains(filter.Keyword));
        }

        if (filter.From.HasValue)
        {
            query = query.Where(comment => comment.CreatedAt >= filter.From.Value.Date);
        }

        if (filter.To.HasValue)
        {
            var exclusiveEnd = filter.To.Value.Date.AddDays(1);
            query = query.Where(comment => comment.CreatedAt < exclusiveEnd);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)filter.PageSize));
        filter.Page = Math.Min(filter.Page, totalPages);

        var comments = await query
            .OrderByDescending(comment => comment.CreatedAt)
            .Select(comment => new AdminCommentListViewModel
            {
                Id = comment.Id,
                PostId = comment.PostId,
                PostTitle = _context.SocialPosts
                    .Where(post => post.Id == comment.PostId)
                    .Select(post => post.Title)
                    .FirstOrDefault() ?? "（貼文已刪除）",
                ParentCommentId = comment.ParentCommentId,
                UserId = comment.UserId,
                AuthorName = _context.UserProfiles
                    .Where(profile => profile.UserId == comment.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault() ?? "未設定暱稱",
                Content = comment.Content,
                Status = comment.Status,
                CreatedAt = comment.CreatedAt
            })
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return View("~/Areas/Social/Views/SocialAdmin/SocialCommentAdmin.cshtml", new CommentAdminPageViewModel
        {
            Status = filter.Status,
            PostId = filter.PostId,
            Keyword = filter.Keyword,
            From = filter.From,
            To = filter.To,
            Page = filter.Page,
            PageSize = filter.PageSize,
            TotalCount = totalCount,
            Comments = comments
        });
    }

    // 隱藏／還原／軟刪除留言
    // POST: /Social/SocialCommentAdmin/SetCommentStatus
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetCommentStatus(
        Guid id,
        string status,
        CancellationToken cancellationToken = default)
    {
        status = status.Trim().ToUpperInvariant();
        if (!AllowedStatuses.Contains(status))
        {
            return BadRequest("不支援的留言狀態。");
        }

        var comment = await _context.SocialComments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (comment is null)
        {
            return NotFound();
        }

        comment.Status = status;
        comment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = $"留言狀態已更新為：{AdminDisplayLabels.Status(status)}。";
        return RedirectToAction(nameof(Index));
    }
}
