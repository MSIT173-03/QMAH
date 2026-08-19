using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("鑰匙流水", order: 40)]
public sealed class KeyTransactionsController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? keyword,
        string? direction,
        int page = 1,
        CancellationToken cancellationToken = default)
    {
        keyword = keyword?.Trim();

        var query =
            from tx in db.KeyTransactions.AsNoTracking()
            join user in db.Users.AsNoTracking() on tx.UserId equals user.Id
            join profile in db.UserProfiles.AsNoTracking() on tx.UserId equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            join key in db.KeyDefinitions.AsNoTracking() on tx.KeyDefinitionId equals key.Id
            select new KeyTransactionListItemViewModel
            {
                Id = tx.Id,
                UserId = tx.UserId,
                MemberName = profile != null && profile.Nickname != null ? profile.Nickname : user.Email!,
                Email = user.Email!,
                KeyName = key.Name,
                KeyCode = key.Code,
                Delta = tx.Amount,
                Reason = tx.Reason,
                ReferenceType = tx.ReferenceType ?? string.Empty,
                CreatedAt = tx.CreatedAt
            };

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x =>
                x.MemberName.Contains(keyword) ||
                x.Email.Contains(keyword) ||
                x.KeyName.Contains(keyword) ||
                x.KeyCode.Contains(keyword) ||
                x.Reason.Contains(keyword));
        }

        if (direction == "increase")
        {
            query = query.Where(x => x.Delta > 0);
        }
        else if (direction == "decrease")
        {
            query = query.Where(x => x.Delta < 0);
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
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        ViewBag.Keyword = keyword;
        ViewBag.Direction = direction;
        ViewBag.CurrentPage = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        return View(records);
    }
}
