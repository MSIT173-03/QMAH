using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Authorize(Roles = "Admin")]
[AdminNavigation("優惠券流水", 50)]
public class CouponTransactionsController : Controller
{
    private readonly QmahDbContext _context;

    public CouponTransactionsController(QmahDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Index(
        string? keyword,
        string? status,
        int page = 1,
        CancellationToken cancellationToken = default)
    {
        keyword = keyword?.Trim();

        var query =
            from coupon in _context.UserCoupons.AsNoTracking()
            join definition in _context.CouponDefinitions.AsNoTracking()
                on coupon.CouponDefinitionId equals definition.Id
            join user in _context.Users.AsNoTracking()
                on coupon.UserId equals user.Id
            join profile in _context.UserProfiles.AsNoTracking()
                on coupon.UserId equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            select new CouponTransactionListItemViewModel
            {
                Id = coupon.Id,
                UserId = coupon.UserId,
                Email = user.Email ?? "",
                Nickname = profile != null ? profile.Nickname : null,
                CouponName = definition.Name,
                CouponCode = definition.Code,
                Status = coupon.Status,
                IssuedAt = coupon.IssuedAt,
                UsedAt = coupon.UsedAt
            };

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x =>
                x.Email.Contains(keyword) ||
                (x.Nickname != null && x.Nickname.Contains(keyword)) ||
                x.CouponName.Contains(keyword) ||
                x.CouponCode.Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        const int pageSize = 10;
        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        if (page < 1)
        {
            page = 1;
        }

        if (totalPages > 0 && page > totalPages)
        {
            page = totalPages;
        }

        var records = await query
            .OrderByDescending(x => x.IssuedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        ViewBag.Keyword = keyword;
        ViewBag.Status = status;
        ViewBag.CurrentPage = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        return View(records);
    }
}
