using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("優惠券背包", 40)]
public sealed class CouponBackpackController(QmahDbContext db) : Controller
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
                UsedAt = coupon.UsedAt
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
                .Where(x => x.IsActive)
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
        CancellationToken cancellationToken)
    {
        var exists = await db.CouponDefinitions.AnyAsync(
            x => x.Id == couponDefinitionId && x.IsActive,
            cancellationToken);

        if (!exists)
        {
            return BadRequest("優惠券不存在或已停用。");
        }

        db.UserCoupons.Add(new UserCoupon
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CouponDefinitionId = couponDefinitionId,
            Status = "AVAILABLE",
            IssuedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = "優惠券已發放。";

        return RedirectToAction(nameof(Index), new { userId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Remove(
        Guid id,
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

        if (coupon.Status != "AVAILABLE")
        {
            TempData["ErrorMessage"] =
                "只有尚未使用的優惠券可以直接移除。";

            return RedirectToAction(
                nameof(Index),
                new { userId = coupon.UserId });
        }

        db.UserCoupons.Remove(coupon);

        await db.SaveChangesAsync(cancellationToken);

        return RedirectToAction(
            nameof(Index),
            new { userId = coupon.UserId });
    }
}
