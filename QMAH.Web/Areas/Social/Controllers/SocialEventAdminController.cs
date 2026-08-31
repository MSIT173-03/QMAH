using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Social;
using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AdminNavigation("活動管理", 50)]
[Authorize(Policy = "Policy.Social.ManageEvents")]
public sealed class SocialEventAdminController : Controller
{
    private static readonly HashSet<string> ReviewStatuses = ["PENDING", "APPROVED", "REJECTED"];
    private static readonly HashSet<string> PublishStatuses = ["DRAFT", "PUBLISHED", "CANCELLED"];
    private static readonly HashSet<string> EventTypes = ["OFFICIAL", "PLAYER"];

    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public SocialEventAdminController(QmahDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public Task<IActionResult> Index(
        string? reviewStatus = null,
        string? publishStatus = null,
        CancellationToken cancellationToken = default) =>
        Events(reviewStatus, publishStatus, cancellationToken);

    [HttpGet]
    public async Task<IActionResult> Events(
        string? reviewStatus = null,
        string? publishStatus = null,
        CancellationToken cancellationToken = default)
    {
        reviewStatus = NormalizeStatus(reviewStatus);
        publishStatus = NormalizeStatus(publishStatus);

        var query = _context.Events.AsNoTracking();
        if (reviewStatus is not null && ReviewStatuses.Contains(reviewStatus))
        {
            query = query.Where(item => item.ReviewStatus == reviewStatus);
        }

        if (publishStatus is not null && PublishStatuses.Contains(publishStatus))
        {
            query = query.Where(item => item.PublishStatus == publishStatus);
        }

        var events = await query
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new EventListViewModel
            {
                Id = item.Id,
                EventType = item.EventType,
                Title = item.Title,
                Description = item.Content,
                Location = item.Location,
                Latitude = item.Latitude,
                Longitude = item.Longitude,
                StartAt = item.StartAt,
                EndAt = item.EndAt,
                Status = item.ReviewStatus,
                PublishStatus = item.PublishStatus,
                ReviewNote = item.ReviewNote,
                CreatedAt = item.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return View("~/Areas/Social/Views/SocialAdmin/SocialEventAdmin.cshtml", new EventAdminPageViewModel
        {
            ReviewStatus = reviewStatus,
            PublishStatus = publishStatus,
            TotalCount = events.Count,
            Events = events
        });
    }

    [HttpGet]
    public IActionResult Create()
    {
        ViewData["IsCreate"] = true;
        return View("~/Areas/Social/Views/SocialAdmin/EventEdit.cshtml", new EventEditViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(EventEditViewModel model, CancellationToken cancellationToken = default)
    {
        ValidateModel(model);
        if (!ModelState.IsValid)
        {
            ViewData["IsCreate"] = true;
            return View("~/Areas/Social/Views/SocialAdmin/EventEdit.cshtml", model);
        }

        var now = DateTime.UtcNow;
        var creatorUserId = _currentUserService.GetCurrentUserId();
        var eventData = new Event
        {
            Id = Guid.NewGuid(),
            EventType = NormalizeEventType(model.EventType),
            OrganizerUserId = creatorUserId,
            Title = model.Title.Trim(),
            Content = model.Content.Trim(),
            Location = NormalizeText(model.Location),
            Latitude = model.Latitude,
            Longitude = model.Longitude,
            StartAt = model.StartAt,
            EndAt = model.EndAt,
            RegistrationEndAt = model.RegistrationEndAt,
            Capacity = model.Capacity,
            ReviewStatus = "PENDING",
            PublishStatus = "DRAFT",
            ReviewNote = NormalizeText(model.ReviewNote),
            CreatedAt = now
        };
        var socialPost = EventSocialPostSynchronizer.Create(
            eventData,
            creatorUserId,
            now,
            model.PostContentMode,
            model.PostTitle,
            model.PostContent);

        _context.Events.Add(eventData);
        _context.SocialPosts.Add(socialPost);

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "活動已建立，等待審核。";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _context.Events
            .AsNoTracking()
            .Include(x => x.SocialPost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        var socialPost = item.SocialPost;
        var isCustomPost = socialPost?.ContentMode == EventSocialPostSynchronizer.CustomMode;
        ViewData["EventId"] = id;
        return View("~/Areas/Social/Views/SocialAdmin/EventEdit.cshtml", new EventEditViewModel
        {
            EventType = item.EventType,
            Title = item.Title,
            Content = item.Content,
            Location = item.Location,
            Latitude = item.Latitude,
            Longitude = item.Longitude,
            StartAt = item.StartAt,
            EndAt = item.EndAt,
            RegistrationEndAt = item.RegistrationEndAt,
            Capacity = item.Capacity,
            ReviewNote = item.ReviewNote,
            PostContentMode = socialPost?.ContentMode ?? EventSocialPostSynchronizer.TemplateMode,
            PostTitle = isCustomPost ? socialPost?.Title : null,
            PostContent = isCustomPost ? socialPost?.Content : null
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(Guid id, EventEditViewModel model, CancellationToken cancellationToken = default)
    {
        ValidateModel(model);
        if (!ModelState.IsValid)
        {
            ViewData["EventId"] = id;
            return View("~/Areas/Social/Views/SocialAdmin/EventEdit.cshtml", model);
        }

        var item = await _context.Events
            .Include(x => x.SocialPost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        item.EventType = NormalizeEventType(model.EventType);
        item.Title = model.Title.Trim();
        item.Content = model.Content.Trim();
        item.Location = NormalizeText(model.Location);
        item.Latitude = model.Latitude;
        item.Longitude = model.Longitude;
        item.StartAt = model.StartAt;
        item.EndAt = model.EndAt;
        item.RegistrationEndAt = model.RegistrationEndAt;
        item.Capacity = model.Capacity;
        item.ReviewStatus = "PENDING";
        item.PublishStatus = "DRAFT";
        item.ReviewNote = NormalizeText(model.ReviewNote);
        item.ReviewedByUserId = null;
        item.ReviewedAt = null;

        await SyncLinkedSocialPostAsync(item, model, cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "活動已更新並重新送回待審核。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ReviewEvent(
        Guid id,
        string status,
        string? reviewNote = null,
        CancellationToken cancellationToken = default)
    {
        status = NormalizeStatus(status) ?? "PENDING";
        if (!ReviewStatuses.Contains(status))
        {
            return BadRequest("不支援的活動審核狀態。");
        }

        var item = await _context.Events
            .Include(x => x.SocialPost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        item.ReviewStatus = status;
        item.ReviewNote = NormalizeText(reviewNote);
        item.ReviewedByUserId = _currentUserService.GetCurrentUserId();
        item.ReviewedAt = DateTime.UtcNow;
        item.PublishStatus = status == "APPROVED" ? "PUBLISHED" : "DRAFT";

        await SyncLinkedSocialPostAsync(item, cancellationToken: cancellationToken);

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = $"活動審核狀態已更新為：{status}。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetPublishStatus(
        Guid id,
        string status,
        CancellationToken cancellationToken = default)
    {
        status = NormalizeStatus(status) ?? "DRAFT";
        if (!PublishStatuses.Contains(status))
        {
            return BadRequest("不支援的活動發布狀態。");
        }

        var item = await _context.Events
            .Include(x => x.SocialPost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        if (status == "PUBLISHED" && item.ReviewStatus != "APPROVED")
        {
            TempData["ErrorMessage"] = "只有審核通過的活動才能發布。";
            return RedirectToAction(nameof(Index));
        }

        item.PublishStatus = status;
        await SyncLinkedSocialPostAsync(item, cancellationToken: cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = $"活動發布狀態已更新為：{status}。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _context.Events
            .Include(x => x.SocialPost)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        // 活動可能已經有人報名，因此保留資料並標記為取消是安全的處理方式。
        item.PublishStatus = "CANCELLED";
        item.ReviewNote = "已由後台標記取消。";
        await SyncLinkedSocialPostAsync(item, cancellationToken: cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = "活動已標記取消。";
        return RedirectToAction(nameof(Index));
    }

    private static string? NormalizeStatus(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private static string NormalizeEventType(string? value) =>
        EventTypes.Contains(value?.Trim().ToUpperInvariant() ?? string.Empty)
            ? value!.Trim().ToUpperInvariant()
            : "OFFICIAL";

    private void ValidateModel(EventEditViewModel model)
    {
        if (model.EndAt <= model.StartAt)
        {
            ModelState.AddModelError(nameof(model.EndAt), "結束時間必須晚於開始時間。");
        }

        if (model.RegistrationEndAt.HasValue && model.RegistrationEndAt.Value > model.StartAt)
        {
            ModelState.AddModelError(nameof(model.RegistrationEndAt), "報名截止時間不能晚於開始時間。");
        }

        if (model.Latitude.HasValue != model.Longitude.HasValue)
        {
            ModelState.AddModelError(nameof(model.Latitude), "地點座標必須同時填寫緯度與經度；也可以兩者都留白，改用手動地址。");
        }

        if (model.PostContentMode == EventSocialPostSynchronizer.CustomMode
            && string.IsNullOrWhiteSpace(model.PostContent))
        {
            ModelState.AddModelError(nameof(model.PostContent), "選擇自訂活動貼文內容時，請輸入貼文內文。");
        }
    }

    private async Task SyncLinkedSocialPostAsync(
        Event eventData,
        EventEditViewModel? editModel = null,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var socialPost = eventData.SocialPost
            ?? await _context.SocialPosts
                .FirstOrDefaultAsync(item => item.EventId == eventData.Id, cancellationToken);
        var creatorUserId = eventData.OrganizerUserId ?? _currentUserService.GetCurrentUserId();

        if (socialPost is null)
        {
            socialPost = EventSocialPostSynchronizer.Create(
                eventData,
                creatorUserId,
                now,
                editModel?.PostContentMode,
                editModel?.PostTitle,
                editModel?.PostContent);
            eventData.SocialPost = socialPost;
            _context.SocialPosts.Add(socialPost);
        }
        else if (editModel is not null)
        {
            EventSocialPostSynchronizer.ApplyContent(
                socialPost,
                eventData,
                editModel.PostContentMode,
                editModel.PostTitle,
                editModel.PostContent);
        }
        else if (socialPost.ContentMode == EventSocialPostSynchronizer.TemplateMode)
        {
            EventSocialPostSynchronizer.ApplyContent(
                socialPost,
                eventData,
                EventSocialPostSynchronizer.TemplateMode,
                null,
                null);
        }
        else
        {
            // 審核或發布狀態變更不應覆蓋管理者自訂的活動貼文內容，仍同步活動類型與地點。
            EventSocialPostSynchronizer.ApplyContent(
                socialPost,
                eventData,
                EventSocialPostSynchronizer.CustomMode,
                socialPost.Title,
                socialPost.Content);
        }

        EventSocialPostSynchronizer.SyncPublication(socialPost, eventData, now);
    }

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
