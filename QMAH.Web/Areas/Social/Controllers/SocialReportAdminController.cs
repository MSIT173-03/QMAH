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
[AdminNavigation("檢舉管理", 40)]
[Authorize(Policy = "Policy.Social.ManageReports")]
public sealed class SocialReportAdminController : Controller
{
    private static readonly HashSet<string> AllowedStatuses = ["PENDING", "RESOLVED", "REJECTED"];
    private static readonly HashSet<string> AllowedTargetTypes = ["POST", "COMMENT"];

    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public SocialReportAdminController(QmahDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public Task<IActionResult> Index(
        [FromQuery] ReportAdminPageViewModel filter,
        CancellationToken cancellationToken = default) =>
        Reports(filter, cancellationToken);

    [HttpGet]
    public async Task<IActionResult> Reports(
        [FromQuery] ReportAdminPageViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Status = Normalize(filter.Status);
        filter.TargetType = Normalize(filter.TargetType);
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();

        var query = _context.ContentReports.AsNoTracking();
        if (filter.Status is not null && AllowedStatuses.Contains(filter.Status))
        {
            query = query.Where(report => report.Status == filter.Status);
        }

        if (filter.TargetType is not null && AllowedTargetTypes.Contains(filter.TargetType))
        {
            query = query.Where(report => report.TargetType == filter.TargetType);
        }

        if (filter.Keyword is not null)
        {
            query = query.Where(report =>
                report.Reason.Contains(filter.Keyword) ||
                (report.Detail != null && report.Detail.Contains(filter.Keyword)) ||
                (report.Resolution != null && report.Resolution.Contains(filter.Keyword)));
        }

        var reports = await query
            .OrderByDescending(report => report.CreatedAt)
            .Select(report => new ReportListViewModel
            {
                Id = report.Id,
                TargetType = report.TargetType,
                TargetId = report.TargetId,
                TargetTitle = report.TargetType == "POST"
                    ? (_context.SocialPosts.Where(post => post.Id == report.TargetId).Select(post => post.Title).FirstOrDefault() ?? "無標題貼文")
                    : "留言檢舉",
                TargetContent = report.TargetType == "POST"
                    ? (_context.SocialPosts.Where(post => post.Id == report.TargetId).Select(post => post.Content).FirstOrDefault() ?? "內容已不存在")
                    : (_context.SocialComments.Where(comment => comment.Id == report.TargetId).Select(comment => comment.Content).FirstOrDefault() ?? "內容已不存在"),
                ReporterName = _context.UserProfiles
                    .Where(profile => profile.UserId == report.ReporterUserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault() ?? "未設定暱稱",
                Reason = report.Reason,
                Detail = report.Detail,
                Status = report.Status,
                Resolution = report.Resolution,
                ReviewedAt = report.ReviewedAt,
                CreatedAt = report.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return View("~/Areas/Social/Views/SocialAdmin/SocialReportAdmin.cshtml", new ReportAdminPageViewModel
        {
            Status = filter.Status,
            TargetType = filter.TargetType,
            Keyword = filter.Keyword,
            TotalCount = reports.Count,
            Reports = reports
        });
    }

    [HttpGet]
    public IActionResult Create()
    {
        ViewData["IsCreate"] = true;
        return View("~/Areas/Social/Views/SocialAdmin/EditReport.cshtml", new ReportEditViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(ReportEditViewModel model, CancellationToken cancellationToken = default)
    {
        await ValidateTarget(model, cancellationToken);
        if (!ModelState.IsValid)
        {
            ViewData["IsCreate"] = true;
            return View("~/Areas/Social/Views/SocialAdmin/EditReport.cshtml", model);
        }

        _context.ContentReports.Add(new ContentReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = _currentUserService.GetCurrentUserId(),
            TargetType = NormalizeTargetType(model.TargetType),
            TargetId = model.TargetId,
            Reason = model.Reason.Trim(),
            Detail = string.IsNullOrWhiteSpace(model.Detail) ? null : model.Detail.Trim(),
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "檢舉紀錄已建立，等待審核。";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var report = await _context.ContentReports.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        ViewData["ReportId"] = id;
        return View("~/Areas/Social/Views/SocialAdmin/EditReport.cshtml", new ReportEditViewModel
        {
            TargetType = report.TargetType,
            TargetId = report.TargetId,
            Reason = report.Reason,
            Detail = report.Detail,
            Status = report.Status,
            Resolution = report.Resolution
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(Guid id, ReportEditViewModel model, CancellationToken cancellationToken = default)
    {
        await ValidateTarget(model, cancellationToken);
        if (!AllowedStatuses.Contains(Normalize(model.Status) ?? string.Empty))
        {
            ModelState.AddModelError(nameof(model.Status), "不支援的檢舉狀態。");
        }

        if (!ModelState.IsValid)
        {
            ViewData["ReportId"] = id;
            return View("~/Areas/Social/Views/SocialAdmin/EditReport.cshtml", model);
        }

        var report = await _context.ContentReports.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        report.TargetType = NormalizeTargetType(model.TargetType);
        report.TargetId = model.TargetId;
        report.Reason = model.Reason.Trim();
        report.Detail = string.IsNullOrWhiteSpace(model.Detail) ? null : model.Detail.Trim();
        report.Resolution = string.IsNullOrWhiteSpace(model.Resolution) ? null : model.Resolution.Trim();
        report.Status = Normalize(model.Status) ?? "PENDING";
        report.ReviewedByUserId = report.Status == "PENDING" ? null : _currentUserService.GetCurrentUserId();
        report.ReviewedAt = report.Status == "PENDING" ? null : DateTime.UtcNow;

        if (report.Status == "RESOLVED")
        {
            await HideTarget(report.TargetType, report.TargetId, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "檢舉紀錄已更新。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ReviewReport(
        Guid reportId,
        string status,
        string? resolution = null,
        CancellationToken cancellationToken = default)
    {
        status = Normalize(status) ?? "PENDING";
        if (!AllowedStatuses.Contains(status))
        {
            return BadRequest("不支援的檢舉審核狀態。");
        }

        var report = await _context.ContentReports.FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        report.Status = status;
        report.Resolution = string.IsNullOrWhiteSpace(resolution) ? null : resolution.Trim();
        report.ReviewedByUserId = status == "PENDING" ? null : _currentUserService.GetCurrentUserId();
        report.ReviewedAt = status == "PENDING" ? null : DateTime.UtcNow;

        if (status == "RESOLVED")
        {
            await HideTarget(report.TargetType, report.TargetId, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = $"檢舉狀態已更新為：{status}。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        var report = await _context.ContentReports.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        _context.ContentReports.Remove(report);
        await _context.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "檢舉紀錄已刪除。";
        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateTarget(ReportEditViewModel model, CancellationToken cancellationToken)
    {
        model.TargetType = NormalizeTargetType(model.TargetType);

        var exists = model.TargetType == "POST"
            ? await _context.SocialPosts.AnyAsync(post => post.Id == model.TargetId, cancellationToken)
            : model.TargetType == "COMMENT" && await _context.SocialComments.AnyAsync(comment => comment.Id == model.TargetId, cancellationToken);

        if (!exists)
        {
            ModelState.AddModelError(nameof(model.TargetId), "找不到指定的貼文或留言。");
        }
    }

    private async Task HideTarget(string targetType, Guid targetId, CancellationToken cancellationToken)
    {
        if (targetType == "POST")
        {
            var post = await _context.SocialPosts.FirstOrDefaultAsync(item => item.Id == targetId, cancellationToken);
            if (post is not null)
            {
                post.Status = "HIDDEN";
                post.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (targetType == "COMMENT")
        {
            var comment = await _context.SocialComments.FirstOrDefaultAsync(item => item.Id == targetId, cancellationToken);
            if (comment is not null)
            {
                comment.Status = "HIDDEN";
                comment.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private static string NormalizeTargetType(string? value) =>
        AllowedTargetTypes.Contains(value?.Trim().ToUpperInvariant() ?? string.Empty)
            ? value!.Trim().ToUpperInvariant()
            : "POST";
}
