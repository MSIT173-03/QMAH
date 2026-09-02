using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("優惠券背包", 40)]
public sealed class CouponBackpackController(
    QmahDbContext db,
    EconomyService economyService,
    UserManager<ApplicationUser> userManager) : Controller
{
    public async Task<IActionResult> Index(
        Guid? userId,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        keyword = keyword?.Trim();

        if (!userId.HasValue)
        {
            var ownersQuery =
                from user in db.Users.AsNoTracking()
                join profile in db.UserProfiles.AsNoTracking()
                    on user.Id equals profile.UserId into profiles
                from profile in profiles.DefaultIfEmpty()
                join coupon in db.UserCoupons.AsNoTracking()
                    on user.Id equals coupon.UserId into coupons
                select new CouponOwnerSummaryViewModel
                {
                    UserId = user.Id,
                    Email = user.Email ?? "",
                    MemberName =
                        profile != null &&
                        profile.Nickname != null
                            ? profile.Nickname
                            : user.Email ?? "",
                    TotalCount = coupons.Count(),
                    AvailableCount =
                        coupons.Count(x => x.Status == "AVAILABLE")
                };

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                ownersQuery = ownersQuery.Where(x =>
                    x.MemberName.Contains(keyword) ||
                    x.Email.Contains(keyword));
            }

            ViewBag.Keyword = keyword;
            ViewBag.OwnerSummaries = await ownersQuery
                .OrderBy(x => x.MemberName)
                .ToListAsync(cancellationToken);

            return View(Array.Empty<CouponBackpackItemViewModel>());
        }

        // 只同步目前選取會員的過期券，讓管理畫面與會員端共用同一套生命週期規則。
        await economyService.SyncExpiredCouponsAsync(userId.Value, cancellationToken);

        var items = await (
            from coupon in db.UserCoupons.AsNoTracking()
            join definition in db.CouponDefinitions.AsNoTracking()
                on coupon.CouponDefinitionId equals definition.Id
            join user in db.Users.AsNoTracking()
                on coupon.UserId equals user.Id
            join profile in db.UserProfiles.AsNoTracking()
                on coupon.UserId equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            where coupon.UserId == userId.Value
            orderby coupon.Status, coupon.IssuedAt descending
            select new CouponBackpackItemViewModel
            {
                Id = coupon.Id,
                UserId = coupon.UserId,
                MemberName =
                    profile != null &&
                    profile.Nickname != null
                        ? profile.Nickname
                        : user.Email ?? "",
                CouponName = definition.Name,
                CouponCode = definition.Code,
                Status = coupon.Status,
                IssuedAt = coupon.IssuedAt,
                ExpiresAt = coupon.ExpiresAt,
                UsedAt = coupon.UsedAt,
                RevokedAt = coupon.RevokedAt,
                IssueReason = coupon.IssueReason,
                RevokeReason = coupon.RevokeReason
            })
            .ToListAsync(cancellationToken);

        var selectedUser = await (
            from user in db.Users.AsNoTracking()
            join profile in db.UserProfiles.AsNoTracking()
                on user.Id equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            where user.Id == userId.Value
            select new
            {
                MemberName =
                    profile != null &&
                    profile.Nickname != null
                        ? profile.Nickname
                        : user.Email ?? ""
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (selectedUser == null)
        {
            return NotFound();
        }

        ViewBag.SelectedUserId = userId.Value;
        ViewBag.SelectedMemberName = selectedUser.MemberName;

        ViewBag.CouponDefinitions = new SelectList(
            await db.CouponDefinitions
                .AsNoTracking()
                .Where(x => x.IsActive && x.AcquisitionType == "ADMIN_GRANT")
                .OrderBy(x => x.Name)
                .ToListAsync(cancellationToken),
            "Id",
            "Name");

        return View(items);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Grant(
        Guid userId,
        Guid couponDefinitionId,
        string reason,
        CancellationToken cancellationToken)
    {
        var admin = await userManager.GetUserAsync(User);
        if (admin is null)
            return Forbid();

        var result = await economyService.GrantCouponAsync(
            admin.Id,
            userId,
            couponDefinitionId,
            reason,
            cancellationToken);
        if (!result.Succeeded)
        {
            TempData["ErrorMessage"] = result.ErrorMessage ?? "優惠券發放失敗。";
            return RedirectToAction(nameof(Index), new { userId });
        }

        TempData["SuccessMessage"] = "優惠券已發放。";

        return RedirectToAction(nameof(Index), new { userId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Remove(
        Guid id,
        string reason,
        CancellationToken cancellationToken)
    {
        var coupon = await db.UserCoupons
            .SingleOrDefaultAsync(
                x => x.Id == id,
                cancellationToken);

        if (coupon is null)
        {
            return NotFound();
        }

        var admin = await userManager.GetUserAsync(User);
        if (admin is null)
            return Forbid();

        var result = await economyService.RevokeCouponAsync(
            admin.Id,
            id,
            reason,
            cancellationToken);
        if (!result.Succeeded)
        {
            TempData["ErrorMessage"] = result.ErrorMessage ?? "優惠券撤銷失敗。";
            return RedirectToAction(
                nameof(Index),
                new { userId = coupon.UserId });
        }

        TempData["SuccessMessage"] = "優惠券已撤銷，原紀錄仍保留。";

        return RedirectToAction(
            nameof(Index),
            new { userId = coupon.UserId });
    }
}
