using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
[AdminNavigation("點數背包", 30)]
public class PointBackpackController : Controller
{
    private readonly QmahDbContext _context;

    public PointBackpackController(QmahDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Index(
        string? keyword,
        int page = 1,
        CancellationToken cancellationToken = default)
    {
        keyword = keyword?.Trim();

        var query =
            from user in _context.Users.AsNoTracking()
            join profile in _context.UserProfiles.AsNoTracking()
                on user.Id equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            join balance in _context.PointBalances.AsNoTracking()
                on user.Id equals balance.UserId into balances
            from balance in balances.DefaultIfEmpty()
            select new PointBackpackListItemViewModel
            {
                UserId = user.Id,
                Email = user.Email ?? "",
                Nickname = profile != null ? profile.Nickname : null,
                Balance = balance != null ? balance.Balance : 0,
                UpdatedAt = balance != null ? balance.UpdatedAt : null
            };

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x =>
                x.Email.Contains(keyword) ||
                (x.Nickname != null && x.Nickname.Contains(keyword)));
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
            .OrderBy(x => x.Nickname ?? x.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        ViewBag.Keyword = keyword;
        ViewBag.CurrentPage = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        return View(records);
    }
}
