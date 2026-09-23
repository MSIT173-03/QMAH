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

// 違規關鍵字表管理：新增/停用/刪除都會觸發 KeywordFilterService 重建 Aho-Corasick 自動機，
// 讓下一篇發文/留言立刻套用最新的關鍵字表，不用重啟服務。
// 洗版防治的 SimHash 設定（比對天數／相似度門檻）也放在同一頁管理，兩者都屬於「內容審核規則」的調整入口。
[Area("Social")]
[AdminNavigation("內容審核設定", 60)]
[Authorize(Policy = "Policy.Social.ManageReports")]
public sealed class ContentKeywordAdminController : Controller
{
    private static readonly HashSet<string> KeywordActions = ["BLOCK", "FLAG"];

    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly KeywordFilterService _keywordFilterService;
    private readonly ContentModerationSettingsService _moderationSettingsService;

    public ContentKeywordAdminController(
        QmahDbContext context,
        ICurrentUserService currentUserService,
        KeywordFilterService keywordFilterService,
        ContentModerationSettingsService moderationSettingsService)
    {
        _context = context;
        _currentUserService = currentUserService;
        _keywordFilterService = keywordFilterService;
        _moderationSettingsService = moderationSettingsService;
    }

    [HttpGet]
    public async Task<IActionResult> Index(
        bool? isActive,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var model = await BuildPageAsync(isActive, keyword, cancellationToken);
        return View("~/Areas/Social/Views/SocialAdmin/ContentKeywordAdmin.cshtml", model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        ContentKeywordCreateViewModel newKeyword,
        bool? isActive,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var action = newKeyword.Action?.Trim().ToUpperInvariant();
        if (action is null || !KeywordActions.Contains(action))
        {
            ModelState.AddModelError(nameof(newKeyword.Action), "動作只能是 BLOCK 或 FLAG。");
        }

        var trimmedKeyword = newKeyword.Keyword?.Trim() ?? "";
        if (!string.IsNullOrWhiteSpace(trimmedKeyword)
            && await _context.ContentKeywords.AnyAsync(item => item.Keyword == trimmedKeyword, cancellationToken))
        {
            ModelState.AddModelError(nameof(newKeyword.Keyword), "這個關鍵字已經在清單裡了，請直接編輯既有項目。");
        }

        if (!ModelState.IsValid)
        {
            var model = await BuildPageAsync(isActive, keyword, cancellationToken);
            model.NewKeyword = newKeyword;
            return View("~/Areas/Social/Views/SocialAdmin/ContentKeywordAdmin.cshtml", model);
        }

        _context.ContentKeywords.Add(new ContentKeyword
        {
            Id = Guid.NewGuid(),
            Keyword = trimmedKeyword,
            Action = action!,
            Category = string.IsNullOrWhiteSpace(newKeyword.Category) ? null : newKeyword.Category.Trim(),
            IsActive = true,
            CreatedByUserId = _currentUserService.GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        await _keywordFilterService.ReloadAsync(cancellationToken);

        TempData["SuccessMessage"] = "關鍵字已新增。";
        return RedirectToAction(nameof(Index), new { isActive, keyword });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(
        Guid id,
        bool isActive,
        bool? filterIsActive,
        string? filterKeyword,
        CancellationToken cancellationToken = default)
    {
        var entity = await _context.ContentKeywords.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        entity.IsActive = isActive;
        await _context.SaveChangesAsync(cancellationToken);
        await _keywordFilterService.ReloadAsync(cancellationToken);

        TempData["SuccessMessage"] = isActive ? "關鍵字已啟用。" : "關鍵字已停用。";
        return RedirectToAction(nameof(Index), new { isActive = filterIsActive, keyword = filterKeyword });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(
        Guid id,
        bool? filterIsActive,
        string? filterKeyword,
        CancellationToken cancellationToken = default)
    {
        var entity = await _context.ContentKeywords.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entity is not null)
        {
            _context.ContentKeywords.Remove(entity);
            await _context.SaveChangesAsync(cancellationToken);
            await _keywordFilterService.ReloadAsync(cancellationToken);
        }

        TempData["SuccessMessage"] = "關鍵字已刪除。";
        return RedirectToAction(nameof(Index), new { isActive = filterIsActive, keyword = filterKeyword });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateModerationSettings(
        ContentModerationSettingsViewModel settings,
        bool? filterIsActive,
        string? filterKeyword,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            var model = await BuildPageAsync(filterIsActive, filterKeyword, cancellationToken);
            model.ModerationSettings = settings;
            return View("~/Areas/Social/Views/SocialAdmin/ContentKeywordAdmin.cshtml", model);
        }

        var entity = await _context.ContentModerationSettings.SingleOrDefaultAsync(
            item => item.Id == ContentModerationSettingsService.SettingsRowId, cancellationToken);
        var now = DateTime.UtcNow;
        if (entity is null)
        {
            entity = new ContentModerationSetting { Id = ContentModerationSettingsService.SettingsRowId };
            _context.ContentModerationSettings.Add(entity);
        }
        entity.SimHashWindowDays = settings.SimHashWindowDays;
        entity.SimHashHammingThreshold = settings.SimHashHammingThreshold;
        entity.UpdatedByUserId = _currentUserService.GetCurrentUserId();
        entity.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);
        await _moderationSettingsService.ReloadAsync(cancellationToken);

        TempData["SuccessMessage"] = "洗版偵測設定已更新。";
        return RedirectToAction(nameof(Index), new { isActive = filterIsActive, keyword = filterKeyword });
    }

    // 關鍵字表通常規模不大，這裡先取前 200 筆，不做完整分頁 UI（跟原本 API 版預設 pageSize=50 相比已經寬裕許多）。
    private async Task<ContentKeywordAdminPageViewModel> BuildPageAsync(
        bool? isActive, string? keyword, CancellationToken cancellationToken)
    {
        var normalizedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

        var query = _context.ContentKeywords.AsNoTracking();
        if (isActive.HasValue)
        {
            query = query.Where(item => item.IsActive == isActive.Value);
        }
        if (normalizedKeyword is not null)
        {
            query = query.Where(item => item.Keyword.Contains(normalizedKeyword));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var keywords = await query
            .OrderByDescending(item => item.CreatedAt)
            .Take(200)
            .Select(item => new ContentKeywordListViewModel
            {
                Id = item.Id,
                Keyword = item.Keyword,
                Action = item.Action,
                Category = item.Category,
                IsActive = item.IsActive,
                CreatedAt = item.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var settingsEntity = await _context.ContentModerationSettings
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == ContentModerationSettingsService.SettingsRowId, cancellationToken);

        return new ContentKeywordAdminPageViewModel
        {
            IsActive = isActive,
            Keyword = normalizedKeyword,
            TotalCount = totalCount,
            Keywords = keywords,
            ModerationSettings = settingsEntity is null
                ? new ContentModerationSettingsViewModel
                {
                    SimHashWindowDays = ContentModerationSettingsService.DefaultSimHashWindowDays,
                    SimHashHammingThreshold = ContentModerationSettingsService.DefaultSimHashHammingThreshold
                }
                : new ContentModerationSettingsViewModel
                {
                    SimHashWindowDays = settingsEntity.SimHashWindowDays,
                    SimHashHammingThreshold = settingsEntity.SimHashHammingThreshold,
                    UpdatedAt = settingsEntity.UpdatedAt
                }
        };
    }
}
