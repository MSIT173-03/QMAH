using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Economy;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Catalog.Controllers;

public sealed record UnlockOwnerRow(Guid Id, string? Nickname, string? Email, int Unlocked, int Refundable);
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
    public async Task<IActionResult> Reset(Guid userId, Guid? categoryId, CancellationToken cancellationToken = default)
    {
        var adminId = Guid.TryParse(_userManager.GetUserId(User), out var parsed) ? parsed : (Guid?)null;
        var (removed, refunded) = await _unlockReset.ResetAsync(userId, categoryId, adminId, cancellationToken);
        TempData["SuccessMessage"] = $"已清除 {removed} 筆解鎖，退還 {refunded} 把鑰匙到背包並寫入流水。";
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
}
