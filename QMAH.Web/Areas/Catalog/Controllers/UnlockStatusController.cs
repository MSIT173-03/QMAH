using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Economy;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Catalog.Controllers;

public sealed record UnlockOwnerRow(Guid Id, string? Nickname, string? Email, int Unlocked, int Refundable);
public sealed record UnlockArtifactRow(Guid Id, string Name, string? Method, DateTime? UnlockedAt);
public sealed record UnlockKeyOption(Guid Id, string Name, int Balance);
public sealed record UnlockCategoryStat(Guid Id, string Name, int Total, int Unlocked, int Refundable);

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("解鎖狀態", order: 35)]
public class UnlockStatusController(QmahDbContext _db, UnlockResetService _unlockReset, UserManager<ApplicationUser> _userManager) : Controller
{
    /// <summary>解鎖狀態：先列會員（管理員在前），選定會員後依圖鑑分類檢視並重置或補解鎖。</summary>
    [HttpGet]
    public async Task<IActionResult> Index(string? txtKeyword, Guid? userId, CancellationToken cancellationToken)
    {
        txtKeyword = txtKeyword?.Trim();
        ViewBag.Keyword = txtKeyword;
        ViewBag.TotalArtifacts = await _db.Artifacts.CountAsync(item => item.IsActive, cancellationToken);

        if (!userId.HasValue)
        {
            var users = _db.Users.AsNoTracking().AsQueryable();
            if (!string.IsNullOrEmpty(txtKeyword))
                users = users.Where(u => (u.Email != null && u.Email.Contains(txtKeyword)) || (u.UserName != null && u.UserName.Contains(txtKeyword))
                    || _db.UserProfiles.Any(p => p.UserId == u.Id && p.Nickname != null && p.Nickname.Contains(txtKeyword)));
            ViewBag.Owners = await (
                from user in users
                orderby _db.UserRoles.Any(r => r.UserId == user.Id && _db.Roles.Any(x => x.Id == r.RoleId && x.Name == "Admin")) descending, user.CreatedAt
                select new UnlockOwnerRow(
                    user.Id,
                    _db.UserProfiles.Where(p => p.UserId == user.Id).Select(p => p.Nickname).FirstOrDefault(),
                    user.Email,
                    _db.ArtifactUnlocks.Count(u => u.UserId == user.Id),
                    _db.ArtifactUnlocks.Count(u => u.UserId == user.Id && u.UnlockMethod == "KEY" && u.KeyTransactionId != null)))
                .Take(200).ToListAsync(cancellationToken);
            return View();
        }

        var member = await (
            from user in _db.Users.AsNoTracking()
            where user.Id == userId.Value
            select new { Name = _db.UserProfiles.Where(p => p.UserId == user.Id).Select(p => p.Nickname).FirstOrDefault() ?? user.Email ?? "未命名會員" })
            .SingleOrDefaultAsync(cancellationToken);
        if (member is null)
            return NotFound();
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
        return View();
    }

    /// <summary>清除該會員的文物解鎖（可限定分類），鑰匙解鎖的退回背包並寫流水。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reset(Guid userId, Guid? categoryId, bool refund = true, CancellationToken cancellationToken = default)
    {
        var adminId = Guid.TryParse(_userManager.GetUserId(User), out var parsed) ? parsed : (Guid?)null;
        var (removed, refunded) = await _unlockReset.ResetAsync(userId, categoryId, adminId, cancellationToken, refund: refund);
        TempData["SuccessMessage"] = refund ? $"已清除 {removed} 筆解鎖，退還 {refunded} 把當初花掉的鑰匙並寫入流水。" : $"已清除 {removed} 筆解鎖，沒有退鑰匙。";
        return RedirectToAction(nameof(Index), new { userId });
    }

    /// <summary>替該會員解鎖尚未解鎖的文物（可限定分類），不扣鑰匙。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Grant(Guid userId, Guid? categoryId, CancellationToken cancellationToken = default)
    {
        var granted = await _unlockReset.GrantAsync(userId, categoryId, cancellationToken);
        TempData["SuccessMessage"] = $"已替會員解鎖 {granted} 件文物。";
        return RedirectToAction(nameof(Index), new { userId });
    }

    /// <summary>逐件調整：列出分類內每件文物的解鎖狀態，勾選後選擇是否扣／退鑰匙。</summary>
    [HttpGet]
    public async Task<IActionResult> Category(Guid userId, Guid categoryId, string? q, CancellationToken cancellationToken)
    {
        var category = await _db.ArtifactCategories.AsNoTracking().SingleOrDefaultAsync(c => c.Id == categoryId, cancellationToken);
        var name = await _db.UserProfiles.Where(p => p.UserId == userId).Select(p => p.Nickname).FirstOrDefaultAsync(cancellationToken)
            ?? await _db.Users.Where(u => u.Id == userId).Select(u => u.Email).FirstOrDefaultAsync(cancellationToken);
        if (category is null || name is null) return NotFound();

        var artifacts = _db.Artifacts.AsNoTracking().Where(a => a.IsActive && a.CategoryId == categoryId);
        var keyword = q?.Trim();
        if (!string.IsNullOrEmpty(keyword)) artifacts = artifacts.Where(a => a.Name.Contains(keyword));
        ViewBag.Rows = await artifacts.OrderBy(a => a.Name).Select(a => new UnlockArtifactRow(
            a.Id, a.Name,
            _db.ArtifactUnlocks.Where(u => u.UserId == userId && u.ArtifactId == a.Id).Select(u => u.UnlockMethod).FirstOrDefault(),
            _db.ArtifactUnlocks.Where(u => u.UserId == userId && u.ArtifactId == a.Id).Select(u => (DateTime?)u.UnlockedAt).FirstOrDefault()))
            .Take(500).ToListAsync(cancellationToken);
        ViewBag.Keys = await (
            from key in _db.KeyDefinitions.AsNoTracking()
            where key.IsActive
            orderby key.Name
            select new UnlockKeyOption(key.Id, key.Name, _db.UserKeyBalances.Where(b => b.UserId == userId && b.KeyDefinitionId == key.Id).Select(b => (int?)b.Balance).FirstOrDefault() ?? 0))
            .ToListAsync(cancellationToken);
        ViewBag.UserId = userId;
        ViewBag.CategoryId = categoryId;
        ViewBag.CategoryName = category.Name;
        ViewBag.MemberName = name;
        ViewBag.Keyword = keyword;
        return View();
    }

    /// <summary>mode：unlock-key 解鎖並扣鑰匙、unlock-free 解鎖不扣、lock-refund 鎖回並退鑰匙、lock-keep 鎖回不退。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Apply(Guid userId, Guid categoryId, Guid[]? artifactIds, string mode, Guid? keyDefinitionId, CancellationToken cancellationToken)
    {
        var back = new { userId, categoryId };
        if (artifactIds is not { Length: > 0 })
        {
            TempData["ErrorMessage"] = "請先勾選要調整的文物。";
            return RedirectToAction(nameof(Category), back);
        }
        var adminId = Guid.TryParse(_userManager.GetUserId(User), out var parsed) ? parsed : (Guid?)null;
        switch (mode)
        {
            case "unlock-key" or "unlock-free":
                if (mode == "unlock-key" && keyDefinitionId is null)
                {
                    TempData["ErrorMessage"] = "請選擇要扣除的鑰匙。";
                    break;
                }
                var (count, error) = await _unlockReset.GrantSelectedAsync(userId, artifactIds, mode == "unlock-key" ? keyDefinitionId : null, adminId, cancellationToken);
                if (error is not null) TempData["ErrorMessage"] = error;
                else TempData["SuccessMessage"] = mode == "unlock-key" ? $"已解鎖 {count} 件並扣除 {count} 把鑰匙，流水已記錄。" : $"已解鎖 {count} 件，沒有扣鑰匙。";
                break;
            case "lock-refund" or "lock-keep":
                var (removed, refunded) = await _unlockReset.ResetAsync(userId, null, adminId, cancellationToken, artifactIds, mode == "lock-refund");
                TempData["SuccessMessage"] = mode == "lock-refund" ? $"已鎖回 {removed} 件，退還 {refunded} 把鑰匙並寫入流水。" : $"已鎖回 {removed} 件，沒有退鑰匙。";
                break;
            default:
                TempData["ErrorMessage"] = "未知的操作。";
                break;
        }
        return RedirectToAction(nameof(Category), back);
    }
}
