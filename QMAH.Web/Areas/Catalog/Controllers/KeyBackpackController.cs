using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Web.Areas.Catalog.Controllers;

public sealed record UnlockCategoryStat(Guid Id, string Name, int Total, int Unlocked, int Refundable);

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("鑰匙背包", order: 30)]
public class KeyBackPackController : Controller
{
    private readonly QmahDbContext _db;
    private readonly EconomyService _economyService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly UnlockResetService _unlockReset;

    public KeyBackPackController(
        QmahDbContext db,
        EconomyService economyService,
        UserManager<ApplicationUser> userManager,
        UnlockResetService unlockReset)
    {
        _unlockReset = unlockReset;
        _db = db;
        _economyService = economyService;
        _userManager = userManager;
    }

    public async Task<ActionResult> Index(
        C_KeywordViewModel vm,
        Guid? userId,
        CancellationToken cancellationToken)
    {
        vm.txtKeyword = vm.txtKeyword?.Trim();

        if (!userId.HasValue)
        {
            var ownerRows = await (
                from user in _db.Users.AsNoTracking()
                join profile in _db.UserProfiles.AsNoTracking()
                    on user.Id equals profile.UserId into profiles
                from profile in profiles.DefaultIfEmpty()
                join balance in _db.UserKeyBalances.AsNoTracking()
                    on user.Id equals balance.UserId into balances
                select new UserKeyOwnerSummaryViewModel
                {
                    UserId = user.Id,
                    Nickname = profile == null ? null : profile.Nickname,
                    Email = user.Email,
                    KeyTypeCount = balances.Count(),
                    TotalBalance = balances.Sum(x => (int?)x.Balance) ?? 0
                })
                .OrderBy(x => x.Nickname ?? x.Email)
                .ToListAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(vm.txtKeyword))
            {
                ownerRows = ownerRows
                    .Where(x =>
                        (x.Nickname ?? "").Contains(
                            vm.txtKeyword,
                            StringComparison.OrdinalIgnoreCase) ||
                        (x.Email ?? "").Contains(
                            vm.txtKeyword,
                            StringComparison.OrdinalIgnoreCase) ||
                        x.UserId.ToString().Contains(
                            vm.txtKeyword,
                            StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            ViewBag.Keyword = vm.txtKeyword;
            ViewBag.OwnerSummaries = ownerRows;

            return View(Array.Empty<UserKeyBalanceViewModel>());
        }

        var member = await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking()
                on user.Id equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            where user.Id == userId.Value
            select new
            {
                Name = profile == null || string.IsNullOrWhiteSpace(profile.Nickname)
                    ? user.Email ?? "未命名會員"
                    : profile.Nickname
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (member is null)
            return NotFound();

        var records = await (
            from key in _db.KeyDefinitions.AsNoTracking()
            join balance in _db.UserKeyBalances.AsNoTracking().Where(item => item.UserId == userId.Value)
                on key.Id equals balance.KeyDefinitionId into balances
            from balance in balances.DefaultIfEmpty()
            where key.IsActive || balance != null
            orderby key.IsActive descending, key.Name
            select new UserKeyBalanceViewModel
            {
                UserId = userId.Value,
                KeyDefinitionId = key.Id,
                KeyName = key.Name,
                KeyCode = key.Code,
                IsActive = key.IsActive,
                Balance = balance == null ? 0 : balance.Balance,
                UpdatedAt = balance == null ? null : balance.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        ViewBag.UnlockStats = await (
            from category in _db.ArtifactCategories.AsNoTracking()
            orderby category.Name
            select new UnlockCategoryStat(
                category.Id,
                category.Name,
                _db.Artifacts.Count(a => a.CategoryId == category.Id && a.IsActive),
                _db.ArtifactUnlocks.Count(u => u.UserId == userId.Value && u.Artifact.CategoryId == category.Id),
                _db.ArtifactUnlocks.Count(u => u.UserId == userId.Value && u.Artifact.CategoryId == category.Id && u.UnlockMethod == "KEY" && u.KeyTransactionId != null)))
            .ToListAsync(cancellationToken);
        ViewBag.SelectedUserId = userId.Value;
        ViewBag.SelectedNickname = member.Name;

        return View(records);
    }

    /// <summary>清除該會員的文物解鎖（可限定分類），鑰匙解鎖的退回背包並寫流水。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetUnlocks(Guid userId, Guid? categoryId, CancellationToken cancellationToken = default)
    {
        var adminId = Guid.TryParse(_userManager.GetUserId(User), out var parsed) ? parsed : (Guid?)null;
        var (removed, refunded) = await _unlockReset.ResetAsync(userId, categoryId, adminId, cancellationToken);
        TempData["SuccessMessage"] = $"已清除 {removed} 筆解鎖，退還 {refunded} 把鑰匙到背包並寫入流水。";
        return RedirectToAction(nameof(Index), new { userId });
    }

    /// <summary>替該會員解鎖尚未解鎖的文物（可限定分類），不扣鑰匙。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> GrantUnlocks(Guid userId, Guid? categoryId, CancellationToken cancellationToken = default)
    {
        var granted = await _unlockReset.GrantAsync(userId, categoryId, cancellationToken);
        TempData["SuccessMessage"] = $"已替會員解鎖 {granted} 件文物。";
        return RedirectToAction(nameof(Index), new { userId });
    }

    [HttpGet]
    public async Task<IActionResult> Adjust(
        Guid userId,
        Guid keyDefinitionId,
        CancellationToken cancellationToken = default)
    {
        var model = await BuildAdjustModelAsync(userId, keyDefinitionId, cancellationToken);
        return model is null ? NotFound() : View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Adjust(
        KeyAdjustViewModel model,
        CancellationToken cancellationToken = default)
    {
        var current = await BuildAdjustModelAsync(model.UserId, model.KeyDefinitionId, cancellationToken);
        if (current is null)
            return NotFound();

        model.Operation = model.Operation?.Trim().ToUpperInvariant() ?? "";
        if (model.Operation is not ("ADD" or "DEDUCT"))
            ModelState.AddModelError(nameof(model.Operation), "請選擇增加或扣除。");
        if (!current.IsKeyActive && model.Operation == "ADD")
            ModelState.AddModelError(nameof(model.Operation), "已停用的鑰匙只能扣除，不能新增。");

        if (!ModelState.IsValid)
        {
            CopyDisplayFields(current, model);
            return View(model);
        }

        var admin = await _userManager.GetUserAsync(User);
        if (admin is null)
            return Forbid();

        var result = await _economyService.AdjustKeysAsync(
            admin.Id,
            model.UserId,
            model.KeyDefinitionId,
            model.Operation == "ADD" ? model.UnitAmount : -model.UnitAmount,
            model.Reason,
            cancellationToken: cancellationToken);
        if (!result.Succeeded)
        {
            ModelState.AddModelError(string.Empty, result.ErrorMessage ?? "鑰匙異動失敗。");
            CopyDisplayFields(current, model);
            return View(model);
        }

        TempData["SuccessMessage"] = "鑰匙餘額已調整，並已留下鑰匙流水。";
        return RedirectToAction(nameof(Index), new { userId = model.UserId });
    }

    private async Task<KeyAdjustViewModel?> BuildAdjustModelAsync(
        Guid userId,
        Guid keyDefinitionId,
        CancellationToken cancellationToken)
    {
        var row = await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking()
                on user.Id equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            join key in _db.KeyDefinitions.AsNoTracking()
                on keyDefinitionId equals key.Id
            join balance in _db.UserKeyBalances.AsNoTracking()
                on new { UserId = user.Id, KeyDefinitionId = key.Id }
                equals new { balance.UserId, balance.KeyDefinitionId } into balances
            from balance in balances.DefaultIfEmpty()
            where user.Id == userId
            select new KeyAdjustViewModel
            {
                UserId = user.Id,
                KeyDefinitionId = key.Id,
                MemberName = profile != null && profile.Nickname != null ? profile.Nickname : user.Email ?? "未命名會員",
                KeyName = key.Name,
                KeyCode = key.Code,
                CurrentBalance = balance == null ? 0 : balance.Balance,
                IsKeyActive = key.IsActive
            })
            .FirstOrDefaultAsync(cancellationToken);
        return row;
    }

    private static void CopyDisplayFields(KeyAdjustViewModel source, KeyAdjustViewModel target)
    {
        target.MemberName = source.MemberName;
        target.KeyName = source.KeyName;
        target.KeyCode = source.KeyCode;
        target.CurrentBalance = source.CurrentBalance;
        target.IsKeyActive = source.IsKeyActive;
    }
}
