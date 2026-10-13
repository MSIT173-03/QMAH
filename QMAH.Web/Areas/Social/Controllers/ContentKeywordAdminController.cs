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

// 違規關鍵字表管理：API 在下一次發文/留言時重新載入規則，不用重啟服務。
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
        bool showPassed = false,
        CancellationToken cancellationToken = default)
    {
        var model = await BuildPageAsync(isActive, keyword, cancellationToken);

        // 讓管理員看得到 AI 複審有沒有在跑：待複審數長期不降代表 API 端沒設定金鑰或額度用完。
        ViewData["AiPending"] = await _context.SocialPosts.CountAsync(item => item.AiReviewedAt == null, cancellationToken)
            + await _context.SocialComments.CountAsync(item => item.AiReviewedAt == null, cancellationToken);
        ViewData["AiReports"] = await _context.ContentReports.CountAsync(item => item.Reason == "AUTO_AI", cancellationToken);
        ViewData["AiReportsPending"] = await _context.ContentReports.CountAsync(item => item.Reason == "AUTO_AI" && item.Status == "PENDING", cancellationToken);
        var aiReviewEnabled = await _context.ContentModerationSettings.AsNoTracking()
            .Where(item => item.Id == ContentModerationSettingsService.SettingsRowId)
            .Select(item => (bool?)item.AiReviewEnabled)
            .FirstOrDefaultAsync(cancellationToken) ?? true;
        ViewData["AiReviewEnabled"] = aiReviewEnabled;
        ViewData["AiToggleLog"] = await LoadAiToggleLogAsync(cancellationToken);
        var since = DateTime.UtcNow.AddHours(-24);
        ViewData["AiReviewed24h"] = await _context.AiReviewLogs.CountAsync(item => item.ReviewedAt >= since, cancellationToken);
        ViewData["AiFlagged24h"] = await _context.AiReviewLogs.CountAsync(item => item.ReviewedAt >= since && item.Flagged, cancellationToken);
        // 預設只列判定違規的紀錄；通過的每次都會寫入，全部列出會淹沒真正需要看的內容。
        var reviewLogQuery = _context.AiReviewLogs.AsNoTracking().Where(item => showPassed || item.Flagged);
        ViewData["AiShowPassed"] = showPassed;
        ViewData["AiReviewLog"] = await reviewLogQuery
            .OrderByDescending(item => item.ReviewedAt)
            .ThenByDescending(item => item.Id)
            .Take(20)
            .ToListAsync(cancellationToken);
        SetAiRuntimeStatus(await _context.AiReviewRuntimeStatuses.AsNoTracking().FirstOrDefaultAsync(item => item.Id == 1, cancellationToken), aiReviewEnabled);
        return View("~/Areas/Social/Views/SocialAdmin/ContentKeywordAdmin.cshtml", model);
    }

    /// <summary>
    /// 把 API 背景排程回報的狀態換成後台看得懂的一句話。排程超過 3 分鐘沒回報（心跳每分鐘一次）視為沒有在跑。
    /// 字串與樣式類別固定在這裡，視圖只負責顯示。
    /// </summary>
    private void SetAiRuntimeStatus(QMAH.Infrastructure.Models.Entities.AiReviewRuntimeStatus? status, bool aiReviewEnabled)
    {
        const int StaleAfterMinutes = 3;
        if (!aiReviewEnabled)
        {
            ViewData["AiStatusLevel"] = "warning";
            ViewData["AiStatusText"] = "AI 審查已由管理員暫停：待複審內容不會送出審查，關鍵字與洗版規則照常運作。可按下方按鈕重新啟用，開關動作會記錄在下方紀錄。";
            return;
        }

        if (status is null || status.HeartbeatAt < DateTime.UtcNow.AddMinutes(-StaleAfterMinutes))
        {
            ViewData["AiStatusLevel"] = "danger";
            ViewData["AiStatusText"] = status is null
                ? "AI 審查排程從未回報，API 程序可能沒有在執行；待複審的內容不會被處理。"
                : $"AI 審查排程已超過 {StaleAfterMinutes} 分鐘沒有回報（最後 {status.HeartbeatAt.ToLocalTime():yyyy-MM-dd HH:mm}），API 程序可能已停止；待複審的內容不會被處理。";
            return;
        }

        if (string.IsNullOrWhiteSpace(status.Provider))
        {
            ViewData["AiStatusLevel"] = "warning";
            ViewData["AiStatusText"] = "AI 審查尚未啟用：API 沒有設定 ContentSafety:ApiKey 或 OpenAi:ApiKey，疑似內容只會累積在「待複審」，不會送出審查。金鑰設定後會自動補審。";
            return;
        }

        ViewData["AiStatusLevel"] = "success";
        ViewData["AiStatusText"] = $"AI 審查運作中，供應商：{status.Provider}（最後回報 {status.HeartbeatAt.ToLocalTime():yyyy-MM-dd HH:mm}）。";
    }

    /// <summary>
    /// 開啟 AI 審查。動作名稱即是稽核紀錄的 Action，<see cref="QMAH.Web.Infrastructure.Audit.AdminAuditLogFilter"/> 會自動寫入 admin.AuditLogs，
    /// 所以這裡不需要另外記錄；後台的「AI 審核開關紀錄」直接讀那張表。
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EnableAiReview(CancellationToken cancellationToken = default) =>
        await SetAiReviewEnabledAsync(true, cancellationToken);

    /// <summary>暫停 AI 審查（見 <see cref="EnableAiReview"/> 的稽核說明）。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DisableAiReview(CancellationToken cancellationToken = default) =>
        await SetAiReviewEnabledAsync(false, cancellationToken);

    private async Task<IActionResult> SetAiReviewEnabledAsync(bool enabled, CancellationToken cancellationToken)
    {
        var entity = await _context.ContentModerationSettings.SingleOrDefaultAsync(
            item => item.Id == ContentModerationSettingsService.SettingsRowId, cancellationToken);
        if (entity is null)
        {
            entity = new ContentModerationSetting
            {
                Id = ContentModerationSettingsService.SettingsRowId,
                SimHashWindowDays = ContentModerationSettingsService.DefaultSimHashWindowDays,
                SimHashHammingThreshold = ContentModerationSettingsService.DefaultSimHashHammingThreshold
            };
            _context.ContentModerationSettings.Add(entity);
        }
        entity.AiReviewEnabled = enabled;
        entity.UpdatedByUserId = _currentUserService.GetCurrentUserId();
        entity.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = enabled ? "已啟用 AI 審查。" : "已暫停 AI 審查。";
        return RedirectToAction(nameof(Index));
    }

    private async Task<List<AiReviewToggleLogItem>> LoadAiToggleLogAsync(CancellationToken cancellationToken) =>
        await _context.AuditLogs.AsNoTracking()
            .Where(log => log.Area == "Social"
                && log.Controller == "ContentKeywordAdmin"
                && (log.Action == nameof(EnableAiReview) || log.Action == nameof(DisableAiReview)))
            .OrderByDescending(log => log.OccurredAt)
            .ThenByDescending(log => log.Id)
            .Take(10)
            .Select(log => new AiReviewToggleLogItem(
                log.OccurredAt,
                log.ActorUser == null ? null : log.ActorUser.UserName,
                log.Action == nameof(EnableAiReview),
                log.ResultStatusCode >= 200 && log.ResultStatusCode < 400))
            .ToListAsync(cancellationToken);

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        [Bind(Prefix = "NewKeyword")] ContentKeywordCreateViewModel newKeyword,
        bool? isActive,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var action = newKeyword.Action?.Trim().ToUpperInvariant();
        if (action is null || !KeywordActions.Contains(action))
        {
            ModelState.AddModelError("NewKeyword.Action", "動作只能是 BLOCK 或 FLAG。");
        }

        var trimmedKeyword = newKeyword.Keyword?.Trim() ?? "";
        if (!string.IsNullOrWhiteSpace(trimmedKeyword)
            && await _context.ContentKeywords.AnyAsync(item => item.Keyword == trimmedKeyword, cancellationToken))
        {
            ModelState.AddModelError("NewKeyword.Keyword", "這個關鍵字已經在清單裡了，請直接編輯既有項目。");
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
        [Bind(Prefix = "ModerationSettings")] ContentModerationSettingsViewModel settings,
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
