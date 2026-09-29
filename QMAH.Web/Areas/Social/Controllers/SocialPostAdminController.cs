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
        ["GENERAL", "CATALOG", "DISCOVERY", "REVIEW", "QUESTION", "GUIDE", "STORE", "EVENTS", "GAME"];

    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly SocialPostMediaService _mediaService;

    public SocialPostAdminController(
        QmahDbContext context,
        ICurrentUserService currentUserService,
        SocialPostMediaService mediaService)
    {
        _context = context;
        _currentUserService = currentUserService;
        _mediaService = mediaService;
    }

    [HttpGet]
    public async Task<IActionResult> Create(CancellationToken cancellationToken = default)
    {
        // 表單只載入必要的分類與啟用文物，避免把管理資料整批送進頁面
        ViewData["IsCreate"] = true;
        ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
        ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
        ViewData["PromotionOptions"] = await LoadPromotionOptions(cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", new PostCreateViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(SocialPostMediaService.MaxRequestSize)]
    [RequestFormLimits(MultipartBodyLengthLimit = SocialPostMediaService.MaxRequestSize)]
    public async Task<IActionResult> Create(
        PostCreateViewModel model,
        CancellationToken cancellationToken = default)
    {
        ValidateModel(model);
        await ValidateArtifactAsync(model, cancellationToken);
        await ValidateImagesAsync(model, existingCount: 0, cancellationToken);
        if (!ModelState.IsValid)
        {
            ViewData["IsCreate"] = true;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
            ViewData["PromotionOptions"] = await LoadPromotionOptions(cancellationToken);
            return View("~/Areas/Social/Views/SocialAdmin/EditPost.cshtml", model);
        }

        var now = DateTime.UtcNow;
        var postType = NormalizePostType(model.PostType);
        var postId = Guid.NewGuid();
        var currentUserId = _currentUserService.GetCurrentUserId();
        _context.SocialPosts.Add(new SocialPost
        {
            Id = postId,
            BoardCode = NormalizeBoardCode(model.BoardCode),
            UserId = currentUserId,
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

        // 圖片外鍵指向貼文，所以貼文要先存進資料庫；格式已在上方驗證過，這裡只剩磁碟寫入可能失敗。
        var failedImages = await _mediaService.AttachAsync(postId, currentUserId, model.Images, cancellationToken);
        TempData["SuccessMessage"] = postType == "ANNOUNCEMENT"
            ? "公告貼文已發布至指定分類。"
            : "一般貼文已發布至指定分類。";
        if (failedImages > 0)
        {
            TempData["Warning"] = $"貼文已發布，但有 {failedImages} 張圖片儲存失敗，請到編輯頁重新上傳。";
        }
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
                CreatedAt = post.CreatedAt,
                Content = post.Content,
                MediaUrls = post.MediaAssets
                    .Where(media => media.Status == "ACTIVE")
                    .OrderBy(media => media.CreatedAt)
                    .Select(media => media.Id.ToString())
                    .ToList()
            })
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        // Web 的 /media 只公開圖鑑與商城素材，社群上傳檔會被擋成 404；
        // 詳情視窗改用受權限保護的 Media action 讀圖。
        foreach (var listItem in posts)
        {
            listItem.MediaUrls = listItem.MediaUrls
                .Select(mediaId => Url.Action(nameof(Media), new { id = mediaId }) ?? string.Empty)
                .Where(url => url.Length > 0)
                .ToList();
        }

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
        ViewData["PromotionOptions"] = await LoadPromotionOptions(cancellationToken);
        ViewData["ExistingMedia"] = await LoadExistingMediaAsync(post.Id, cancellationToken);
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
    [RequestSizeLimit(SocialPostMediaService.MaxRequestSize)]
    [RequestFormLimits(MultipartBodyLengthLimit = SocialPostMediaService.MaxRequestSize)]
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
        var existingMedia = await LoadExistingMediaAsync(id, cancellationToken);
        var keptCount = existingMedia.Count(media => !model.RemoveMediaIds.Contains(media.Id));
        await ValidateImagesAsync(model, keptCount, cancellationToken);
        if (!ModelState.IsValid)
        {
            ViewData["PostId"] = id;
            ViewData["BoardCodes"] = await LoadBoardCodes(cancellationToken);
            ViewData["ArtifactOptions"] = await LoadArtifactOptions(cancellationToken);
            ViewData["PromotionOptions"] = await LoadPromotionOptions(cancellationToken);
            ViewData["ExistingMedia"] = existingMedia;
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
        await _mediaService.MarkDeletedAsync(id, model.RemoveMediaIds, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);

        // 新圖片的擁有者記為這次編輯的管理員，貼文作者不變。
        var failedImages = await _mediaService.AttachAsync(
            id,
            _currentUserService.GetCurrentUserId(),
            model.Images,
            cancellationToken);
        TempData["SuccessMessage"] = "貼文內容已更新。";
        if (failedImages > 0)
        {
            TempData["Warning"] = $"貼文已更新，但有 {failedImages} 張圖片儲存失敗，請重新上傳。";
        }
        return RedirectToAction(nameof(Index));
    }

    // 後台預覽社群圖片：Web 的 /media 路徑不公開社群上傳檔，改由這個受 ManagePosts 權限保護的 action 讀檔。
    // 管理員需要看到已隱藏／已刪除貼文的圖片以便審核，所以只檢查圖片本身是否仍為 ACTIVE。
    // GET: /Social/SocialPostAdmin/Media/{id}
    [HttpGet]
    public async Task<IActionResult> Media(Guid id, CancellationToken cancellationToken = default)
    {
        var asset = await _context.MediaAssets
            .AsNoTracking()
            .Where(item => item.Id == id && item.Status == "ACTIVE")
            .Select(item => new { item.StoredPath, item.ContentType })
            .FirstOrDefaultAsync(cancellationToken);
        if (asset is null)
        {
            return NotFound();
        }

        var physicalPath = _mediaService.TryResolveExistingFile(asset.StoredPath);
        if (physicalPath is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "private,max-age=300";
        return PhysicalFile(physicalPath, asset.ContentType);
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

    private async Task<List<PostPromotionOption>> LoadPromotionOptions(CancellationToken cancellationToken)
    {
        // 快速插入只提供現在可使用的規則；結帳仍會重新驗證優惠券，編輯器不複製交易邏輯。
        var now = DateTime.UtcNow;
        var definitions = await _context.CouponDefinitions
            .AsNoTracking()
            .Where(coupon => coupon.IsActive && coupon.EndAt > now)
            .OrderBy(coupon => coupon.StartAt)
            .ThenBy(coupon => coupon.Code)
            .Take(20)
            .ToListAsync(cancellationToken);

        return definitions.Select(coupon => new PostPromotionOption(
            coupon.Id,
            string.IsNullOrWhiteSpace(coupon.Name) ? coupon.Code : coupon.Name,
            coupon.Code,
            coupon.DiscountType.Trim().ToUpperInvariant() == "PERCENT"
                ? $"折扣 {coupon.DiscountValue:0.##}%"
                : $"折抵 NT${coupon.DiscountValue:0.##}",
            coupon.AcquisitionType.Trim().ToUpperInvariant() == "POINT_EXCHANGE" ? "鑑定點數兌換" : "官方發放",
            coupon.MinimumAmount > 0 ? $"滿 NT${coupon.MinimumAmount:0.##}" : "不限金額",
            $"{coupon.StartAt.ToLocalTime():yyyy/MM/dd}－{coupon.EndAt.ToLocalTime():yyyy/MM/dd}",
            coupon.ValidityDays > 0 ? $"發放後 {coupon.ValidityDays} 天內有效" : "依商城規則"))
            .ToList();
    }

    private async Task<List<PostMediaItem>> LoadExistingMediaAsync(Guid postId, CancellationToken cancellationToken)
    {
        var assets = await _mediaService.GetActiveAsync(postId, cancellationToken);
        return assets
            .Select(asset => new PostMediaItem(
                asset.Id,
                Url.Action(nameof(Media), new { id = asset.Id }) ?? string.Empty,
                asset.OriginalFileName))
            .ToList();
    }

    private async Task ValidateImagesAsync(
        PostCreateViewModel model,
        int existingCount,
        CancellationToken cancellationToken)
    {
        var errors = await _mediaService.ValidateAsync(model.Images, existingCount, cancellationToken);
        foreach (var error in errors)
        {
            ModelState.AddModelError(nameof(model.Images), error);
        }
    }

    private void ValidateModel(PostCreateViewModel model)
    {
        var postType = NormalizePostType(model.PostType);
        if (!AllowedPostTypes.Contains(postType))
        {
            ModelState.AddModelError(nameof(model.PostType), "請選擇一般貼文或公告貼文。");
        }

        // 貼文管理權限也包含內容審核員；公告只開放 Admin 與公告小編發布，與 API 的規則一致。
        if (postType == "ANNOUNCEMENT" && !CanPublishAnnouncement())
        {
            ModelState.AddModelError(nameof(model.PostType), "只有管理員或公告小編可以發布公告貼文。");
        }

        if (model.Latitude.HasValue != model.Longitude.HasValue)
        {
            ModelState.AddModelError(nameof(model.Latitude), "地點座標必須同時填寫緯度與經度；也可以兩者都留白。");
        }
    }

    // 公告只有具備管理權限的發布者才算官方公告，其餘仍標記為社群公告
    private string GetPublisherType(string postType) =>
        postType == "ANNOUNCEMENT" && CanPublishAnnouncement()
            ? "OFFICIAL"
            : "COMMUNITY";

    private bool CanPublishAnnouncement() =>
        User.IsInRole("Admin") || User.IsInRole("AnnouncementEditor");

    private static string NormalizePostType(string? postType) =>
        string.IsNullOrWhiteSpace(postType) ? "POST" : postType.Trim().ToUpperInvariant();

    private static string NormalizeBoardCode(string? boardCode) =>
        string.IsNullOrWhiteSpace(boardCode) ? "GENERAL" : boardCode.Trim().ToUpperInvariant();

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
