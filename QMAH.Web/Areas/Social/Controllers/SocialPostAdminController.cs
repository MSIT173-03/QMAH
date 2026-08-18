using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AdminNavigation("貼文處理", 30)]
[Authorize(Policy = "Policy.Social.ManageReports")]
public class SocialPostAdminController : Controller
{
    private static readonly HashSet<string> AllowedStatuses = ["PUBLISHED", "HIDDEN", "DELETED"];

    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public SocialPostAdminController(QmahDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<IActionResult> Create(CancellationToken cancellationToken = default)
    {
        ViewData["IsCreate"] = true;
        ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", new PostCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        PostCreateViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            ViewData["IsCreate"] = true;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", model);
        }

        var now = DateTime.UtcNow;
        _context.SocialPosts.Add(new SocialPost
        {
            Id = Guid.NewGuid(),
            BoardCode = NormalizeBoardCode(model.BoardCode),
            UserId = _currentUserService.GetCurrentUserId(),
            ArtifactId = model.ArtifactId,
            Title = model.Title.Trim(),
            Content = model.Content.Trim(),
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "貼文已新增至指定板塊。";
        return RedirectToAction(nameof(Index));
    }

    // GET: /Social/SocialPostAdmin/Posts
    [HttpGet]
    public async Task<IActionResult> Posts(
        [FromQuery] SocialPostAdminPageViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();
        filter.BoardCode = string.IsNullOrWhiteSpace(filter.BoardCode) ? null : filter.BoardCode.Trim();
        filter.Status = string.IsNullOrWhiteSpace(filter.Status) ? null : filter.Status.Trim().ToUpperInvariant();

        var query = _context.SocialPosts.AsNoTracking();

        if (filter.Keyword is not null)
        {
            query = query.Where(post =>
                post.Title.Contains(filter.Keyword) ||
                post.Content.Contains(filter.Keyword));
        }

        if (filter.BoardCode is not null)
        {
            query = query.Where(post => post.BoardCode == filter.BoardCode);
        }

        if (filter.Status is not null && AllowedStatuses.Contains(filter.Status))
        {
            query = query.Where(post => post.Status == filter.Status);
        }

        if (filter.From.HasValue)
        {
            query = query.Where(post => post.CreatedAt >= filter.From.Value.Date);
        }

        if (filter.To.HasValue)
        {
            var exclusiveEnd = filter.To.Value.Date.AddDays(1);
            query = query.Where(post => post.CreatedAt < exclusiveEnd);
        }

        var boardCodes = await _context.SocialPosts
            .AsNoTracking()
            .Select(post => post.BoardCode)
            .Distinct()
            .OrderBy(boardCode => boardCode)
            .ToListAsync(cancellationToken);

        var posts = await query
            .OrderByDescending(post => post.CreatedAt)
            .Select(post => new AdminPostListViewModel
            {
                Id = post.Id,
                Title = post.Title,
                AuthorName = _context.UserProfiles
                    .Where(profile => profile.UserId == post.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault() ?? "未設定暱稱",
                BoardCode = post.BoardCode,
                Status = post.Status,
                CommentCount = post.SocialComments.Count(comment => comment.Status == "PUBLISHED"),
                CreatedAt = post.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var model = new SocialPostAdminPageViewModel
        {
            Keyword = filter.Keyword,
            BoardCode = filter.BoardCode,
            Status = filter.Status,
            From = filter.From,
            To = filter.To,
            TotalCount = posts.Count,
            BoardCodes = boardCodes,
            Posts = posts
        };

        return View("~/Areas/Social/Views/SocialAdmin/SocialPostAdmin.cshtml", model);
    }

    public Task<IActionResult> Index(
        [FromQuery] SocialPostAdminPageViewModel filter,
        CancellationToken cancellationToken = default) => Posts(filter, cancellationToken);

    [HttpGet("Edit/{id:Guid}")]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var post = await _context.SocialPosts
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (post is null)
        {
            return NotFound();
        }

        ViewData["PostId"] = post.Id;
        ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", new PostCreateViewModel
        {
            BoardCode = post.BoardCode,
            Title = post.Title,
            Content = post.Content,
            ArtifactId = post.ArtifactId
        });
    }

    [HttpPost("Edit/{id:Guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        PostCreateViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            ViewData["PostId"] = id;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", model);
        }

        var post = await _context.SocialPosts.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (post is null)
        {
            return NotFound();
        }

        post.BoardCode = NormalizeBoardCode(model.BoardCode);
        post.Title = model.Title.Trim();
        post.Content = model.Content.Trim();
        post.ArtifactId = model.ArtifactId;
        post.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "貼文內容已更新。";
        return RedirectToAction(nameof(Index));
    }

    // POST: /Social/SocialPostAdmin/SetPostStatus
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetPostStatus(
        Guid id,
        string status,
        CancellationToken cancellationToken = default)
    {
        status = status.Trim().ToUpperInvariant();
        if (!AllowedStatuses.Contains(status))
        {
            return BadRequest("不支援的貼文狀態。");
        }

        var post = await _context.SocialPosts.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (post is null)
        {
            return NotFound();
        }

        post.Status = status;
        post.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = $"貼文狀態已更新為：{status}。";
        return RedirectToAction(nameof(Index));
    }

    // 保留既有入口，避免其他頁面或既有連結失效。
    [HttpPost]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> TogglePostStatus(
        Guid id,
        string status,
        CancellationToken cancellationToken = default) => SetPostStatus(id, status, cancellationToken);

    private async Task<List<string>> LoadBoardCodes(CancellationToken cancellationToken)
    {
        var boardCodes = await _context.SocialPosts
            .AsNoTracking()
            .Select(post => post.BoardCode)
            .Distinct()
            .OrderBy(boardCode => boardCode)
            .ToListAsync(cancellationToken);

        if (!boardCodes.Contains("GENERAL"))
        {
            boardCodes.Insert(0, "GENERAL");
        }

        return boardCodes;
    }

    private static string NormalizeBoardCode(string? boardCode) =>
        string.IsNullOrWhiteSpace(boardCode) ? "GENERAL" : boardCode.Trim().ToUpperInvariant();
}
