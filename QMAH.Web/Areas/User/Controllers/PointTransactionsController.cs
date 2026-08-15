using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public class PointTransactionsController : Controller
{
    private readonly QmahDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public PointTransactionsController(
        QmahDbContext context,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public IActionResult Index(
        string? keyword,
        string? amountType,
        int page = 1)
    {
        var query = _context.PointTransactions
            .AsNoTracking()
            .AsQueryable();

        // 關鍵字搜尋
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            keyword = keyword.Trim();

            // 先找 Email 符合的會員 Id
            var matchedUserIds = _userManager.Users
                .AsNoTracking()
                .Where(x =>
                    x.Email != null &&
                    x.Email.Contains(keyword))
                .Select(x => x.Id)
                .ToList();

            query = query.Where(x =>
                x.Reason.Contains(keyword) ||
                (x.ReferenceType != null &&
                 x.ReferenceType.Contains(keyword)) ||
                matchedUserIds.Contains(x.UserId)
            );
        }

        // 增加 / 扣除篩選
        if (amountType == "increase")
        {
            query = query.Where(x => x.Amount > 0);
        }
        else if (amountType == "decrease")
        {
            query = query.Where(x => x.Amount < 0);
        }

        int pageSize = 10;

        int totalCount = query.Count();

        int totalPages = (int)Math.Ceiling(
            totalCount / (double)pageSize
        );

        if (page < 1)
        {
            page = 1;
        }

        if (totalPages > 0 && page > totalPages)
        {
            page = totalPages;
        }

        var transactions = query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // 一次取得這批流水涉及的會員
        var userIds = transactions
            .Select(x => x.UserId)
            .Distinct()
            .ToList();

        var users = _userManager.Users
            .AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionary(
                x => x.Id,
                x => x.Email ?? ""
            );

        var result = transactions
            .Select(x => new PointTransactionListItemViewModel
            {
                Transaction = x,

                Email = users.TryGetValue(
                    x.UserId,
                    out var email)
                        ? email
                        : "找不到會員"
            })
            .ToList();

        ViewBag.Keyword = keyword;
        ViewBag.AmountType = amountType;

        ViewBag.CurrentPage = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        return View(result);
    }
}