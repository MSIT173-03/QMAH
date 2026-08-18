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

        _context.Events.Add(new Event
        {
            Id = Guid.NewGuid(),
            EventType = NormalizeEventType(model.EventType),
            OrganizerUserId = _currentUserService.GetCurrentUserId(),
            Title = model.Title.Trim(),
            Content = model.Content.Trim(),
            Location = string.IsNullOrWhiteSpace(model.Location) ? null : model.Location.Trim(),
            StartAt = model.StartAt,
            EndAt = model.EndAt,
            RegistrationEndAt = model.RegistrationEndAt,
            Capacity = model.Capacity,
            ReviewStatus = "PENDING",
            PublishStatus = "DRAFT",
            ReviewNote = model.ReviewNote,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "活動已建立，等待審核。";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _context.Events.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        ViewData["EventId"] = id;
        return View("~/Areas/Social/Views/SocialAdmin/EventEdit.cshtml", new EventEditViewModel
        {
            EventType = item.EventType,
            Title = item.Title,
            Content = item.Content,
            Location = item.Location,
            StartAt = item.StartAt,
            EndAt = item.EndAt,
            RegistrationEndAt = item.RegistrationEndAt,
            Capacity = item.Capacity,
            ReviewNote = item.ReviewNote
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

        var item = await _context.Events.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        item.EventType = NormalizeEventType(model.EventType);
        item.Title = model.Title.Trim();
        item.Content = model.Content.Trim();
        item.Location = string.IsNullOrWhiteSpace(model.Location) ? null : model.Location.Trim();
        item.StartAt = model.StartAt;
        item.EndAt = model.EndAt;
        item.RegistrationEndAt = model.RegistrationEndAt;
        item.Capacity = model.Capacity;
        item.ReviewStatus = "PENDING";
        item.PublishStatus = "DRAFT";
        item.ReviewNote = model.ReviewNote;
        item.ReviewedByUserId = null;
        item.ReviewedAt = null;

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

        var item = await _context.Events.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        item.ReviewStatus = status;
        item.ReviewNote = string.IsNullOrWhiteSpace(reviewNote) ? null : reviewNote.Trim();
        item.ReviewedByUserId = _currentUserService.GetCurrentUserId();
        item.ReviewedAt = DateTime.UtcNow;
        item.PublishStatus = status == "APPROVED" ? "PUBLISHED" : "DRAFT";

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

        var item = await _context.Events.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
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
        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = $"活動發布狀態已更新為：{status}。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _context.Events.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        // Events may already have registrations, so CANCELLED is the safe delete state.
        item.PublishStatus = "CANCELLED";
        item.ReviewNote = "已由後台標記刪除。";
        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = "活動已標記刪除。";
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
    }
}
