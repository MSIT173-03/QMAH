using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Infrastructure;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AdminNavigation("貼文處理", 30)]
[Authorize(Policy = "Policy.Social.ManagePosts")]
public sealed class SocialPostAdminController : Controller
{
    private static readonly int[] PageSizes = [10, 20, 50, 100];
    private static readonly HashSet<string> AllowedStatuses = ["PUBLISHED", "HIDDEN", "DELETED"];
    private static readonly HashSet<string> AllowedPostTypes = ["POST", "ANNOUNCEMENT"];
    private static readonly string[] StandardBoardCodes =
        ["GENERAL", "CATALOG", "DISCOVERY", "REVIEW", "QUESTION", "GUIDE"];

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
        // 表單只載入必要的分類與啟用文物，避免把管理資料整批送進頁面
        ViewData["IsCreate"] = true;
        ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
        ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", new PostCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        PostCreateViewModel model,
        CancellationToken cancellationToken = default)
    {
        ValidateModel(model);
        await ValidateArtifactAsync(model, cancellationToken);
        if (!ModelState.IsValid)
        {
            ViewData["IsCreate"] = true;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
            return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", model);
        }

        var now = DateTime.UtcNow;
        var postType = NormalizePostType(model.PostType);
        _context.SocialPosts.Add(new SocialPost
        {
            Id = Guid.NewGuid(),
            BoardCode = NormalizeBoardCode(model.BoardCode),
            UserId = _currentUserService.GetCurrentUserId(),
            ArtifactId = model.ArtifactId,
            PostType = postType,
            PublisherType = GetPublisherType(postType),
            ContentMode = "CUSTOM",
            Title = model.Title.Trim(),
            Content = model.Content.Trim(),
            LocationName = NormalizeText(model.LocationName),
            Latitude = model.Latitude,
            Longitude = model.Longitude,
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = postType == "ANNOUNCEMENT"
            ? "公告貼文已發布至指定分類。"
            : "一般貼文已發布至指定分類。";
        return RedirectToAction(nameof(Index));
    }

    // 列表在資料庫完成篩選、計數、排序與分頁，只投影本頁需要的欄位
    // GET: /Social/SocialPostAdmin/Posts
    [HttpGet]
    public async Task<IActionResult> Posts(
        [FromQuery] SocialPostAdminPageViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Page = Math.Max(1, filter.Page);
        filter.PageSize = PageSizes.Contains(filter.PageSize) ? filter.PageSize : 20;
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();
        filter.BoardCode = string.IsNullOrWhiteSpace(filter.BoardCode) ? null : filter.BoardCode.Trim().ToUpperInvariant();
        filter.PostType = string.IsNullOrWhiteSpace(filter.PostType) ? null : NormalizePostType(filter.PostType);
        filter.Status = string.IsNullOrWhiteSpace(filter.Status) ? null : filter.Status.Trim().ToUpperInvariant();

        var query = _context.SocialPosts.AsNoTracking();

        if (filter.Keyword is not null)
        {
            query = query.Where(post =>
                post.Title.Contains(filter.Keyword)
                || post.Content.Contains(filter.Keyword));
        }

        if (filter.BoardCode is not null)
        {
            query = query.Where(post => post.BoardCode == filter.BoardCode);
        }

        if (filter.PostType is not null && AllowedPostTypes.Contains(filter.PostType))
        {
            query = query.Where(post => post.PostType == filter.PostType);
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

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)filter.PageSize));
        filter.Page = Math.Min(filter.Page, totalPages);

        var boardCodes = await LoadBoardCodes(cancellationToken);
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
                PostType = post.PostType,
                PublisherType = post.PublisherType,
                EventId = post.EventId,
                LocationName = post.LocationName,
                Latitude = post.Latitude,
                Longitude = post.Longitude,
                Status = post.Status,
                CommentCount = post.SocialComments.Count(comment => comment.Status == "PUBLISHED"),
                CreatedAt = post.CreatedAt
            })
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return View("~/Areas/Social/Views/SocialAdmin/SocialPostAdmin.cshtml", new SocialPostAdminPageViewModel
        {
            Keyword = filter.Keyword,
            BoardCode = filter.BoardCode,
            PostType = filter.PostType,
            Status = filter.Status,
            From = filter.From,
            To = filter.To,
            Page = filter.Page,
            PageSize = filter.PageSize,
            TotalCount = totalCount,
            BoardCodes = boardCodes,
            Posts = posts
        });
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

        if (post.EventId.HasValue)
        {
            return RedirectToAction(
                "Edit",
                "SocialEventAdmin",
                new { area = "Social", id = post.EventId.Value });
        }

        ViewData["PostId"] = post.Id;
        ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
        ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", new PostCreateViewModel
        {
            PostType = NormalizePostType(post.PostType),
            BoardCode = post.BoardCode,
            Title = post.Title,
            Content = post.Content,
            ArtifactId = post.ArtifactId,
            LocationName = post.LocationName,
            Latitude = post.Latitude,
            Longitude = post.Longitude
        });
    }

    [HttpPost("Edit/{id:Guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        PostCreateViewModel model,
        CancellationToken cancellationToken = default)
    {
        var post = await _context.SocialPosts
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (post is null)
        {
            return NotFound();
        }

        if (post.EventId.HasValue)
        {
            TempData["ErrorMessage"] = "活動貼文請從活動管理編輯，避免活動資料與貼文內容不同步。";
            return RedirectToAction(nameof(Index));
        }

        ValidateModel(model);
        await ValidateArtifactAsync(model, cancellationToken);
        if (!ModelState.IsValid)
        {
            ViewData["PostId"] = id;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
            return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", model);
        }

        var postType = NormalizePostType(model.PostType);
        post.BoardCode = NormalizeBoardCode(model.BoardCode);
        post.PostType = postType;
        post.PublisherType = GetPublisherType(postType);
        post.ContentMode = "CUSTOM";
        post.Title = model.Title.Trim();
        post.Content = model.Content.Trim();
        post.ArtifactId = model.ArtifactId;
        post.LocationName = NormalizeText(model.LocationName);
        post.Latitude = model.Latitude;
        post.Longitude = model.Longitude;
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

        if (post.EventId.HasValue)
        {
            TempData["ErrorMessage"] = "活動貼文的可見狀態請從活動管理處理。";
            return RedirectToAction(nameof(Index));
        }

        post.Status = status;
        post.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = $"貼文狀態已更新為：{AdminDisplayLabels.Status(status)}。";
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
        // 固定分類和資料庫既有分類合併，舊貼文仍能被找到
        var existingCodes = await _context.SocialPosts
            .AsNoTracking()
            .Select(post => post.BoardCode)
            .Distinct()
            .ToListAsync(cancellationToken);

        return StandardBoardCodes
            .Concat(existingCodes)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();
    }

    private async Task ValidateArtifactAsync(PostCreateViewModel model, CancellationToken cancellationToken)
    {
        if (model.ArtifactId.HasValue
            && !await _context.Artifacts.AnyAsync(
                artifact => artifact.Id == model.ArtifactId.Value && artifact.IsActive,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.ArtifactId), "找不到可關聯的啟用文物。");
        }
    }

    private async Task<List<PostArtifactOption>> LoadArtifactOptions(CancellationToken cancellationToken)
    {
        // 下拉選單只提供啟用文物，避免新貼文連到已下架資料
        return await _context.Artifacts
            .AsNoTracking()
            .Where(artifact => artifact.IsActive)
            .OrderBy(artifact => artifact.ArtifactRef)
            .Select(artifact => new PostArtifactOption(
                artifact.Id,
                artifact.ArtifactRef,
                artifact.Name))
            // 限制下拉選單大小，避免管理表單一次載入過多選項
            .Take(512)
            .ToListAsync(cancellationToken);
    }

    private void ValidateModel(PostCreateViewModel model)
    {
        var postType = NormalizePostType(model.PostType);
        if (!AllowedPostTypes.Contains(postType))
        {
            ModelState.AddModelError(nameof(model.PostType), "請選擇一般貼文或公告貼文。");
        }

        if (model.Latitude.HasValue != model.Longitude.HasValue)
        {
            ModelState.AddModelError(nameof(model.Latitude), "地點座標必須同時填寫緯度與經度；也可以兩者都留白。");
        }
    }

    // 公告只有具備管理權限的發布者才算官方公告，其餘仍標記為社群公告
    private string GetPublisherType(string postType) =>
        postType == "ANNOUNCEMENT"
            && (User.IsInRole("Admin") || User.IsInRole("AnnouncementEditor"))
            ? "OFFICIAL"
            : "COMMUNITY";

    private static string NormalizePostType(string? postType) =>
        string.IsNullOrWhiteSpace(postType) ? "POST" : postType.Trim().ToUpperInvariant();

    private static string NormalizeBoardCode(string? boardCode) =>
        string.IsNullOrWhiteSpace(boardCode) ? "GENERAL" : boardCode.Trim().ToUpperInvariant();

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
