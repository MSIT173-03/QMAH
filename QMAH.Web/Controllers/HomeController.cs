using System.Diagnostics;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Web.Models;

namespace QMAH.Web.Controllers;

[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public sealed class HomeController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var trendStart = today.AddDays(-13);
        var paidOrders = db.StoreOrders
            .AsNoTracking()
            .Where(order => order.PaidAt != null);

        var recentPaidOrders = await paidOrders
            .Where(order => order.PaidAt >= trendStart)
            .Select(order => new { order.PaidAt, order.TotalAmount })
            .ToListAsync(cancellationToken);

        var trend = Enumerable.Range(0, 14)
            .Select(offset =>
            {
                var date = trendStart.AddDays(offset);
                var dayOrders = recentPaidOrders
                    .Where(order => order.PaidAt!.Value.Date == date)
                    .ToList();
                return new HomeDashboardTrendItem(
                    date,
                    dayOrders.Count,
                    dayOrders.Sum(order => order.TotalAmount));
            })
            .ToList();

        var orderStatusRows = await db.StoreOrders
            .AsNoTracking()
            .GroupBy(order => order.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var orderStatuses = orderStatusRows
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.Status)
            .Select(item => new HomeDashboardStatusItem(item.Status, item.Count))
            .ToList();

        var hotProductRows = await (
            from detail in db.OrderDetails.AsNoTracking()
            join order in db.StoreOrders.AsNoTracking() on detail.OrderId equals order.Id
            where order.PaidAt != null
            group detail by new { detail.ProductId, detail.ProductNameSnapshot } into product
            select new
            {
                product.Key.ProductId,
                Name = product.Key.ProductNameSnapshot,
                Quantity = product.Sum(detail => detail.Quantity),
                Revenue = product.Sum(detail => detail.LineTotal)
            })
            .OrderByDescending(item => item.Quantity)
            .ThenByDescending(item => item.Revenue)
            .Take(5)
            .ToListAsync(cancellationToken);

        var hotProducts = hotProductRows
            .OrderByDescending(item => item.Quantity)
            .ThenByDescending(item => item.Revenue)
            .Take(5)
            .Select(item => new HomeDashboardProductItem(item.ProductId, item.Name, item.Quantity, item.Revenue))
            .ToList();

        var paidOrderCount = await paidOrders.CountAsync(cancellationToken);

        var model = new HomeDashboardViewModel
        {
            ArtifactCount = await db.Artifacts.CountAsync(cancellationToken),
            ActiveArtifactCount = await db.Artifacts.CountAsync(
                artifact => artifact.IsActive,
                cancellationToken),
            PublishedPostCount = await db.SocialPosts.CountAsync(
                post => post.Status == "PUBLISHED",
                cancellationToken),
            ActiveEventCount = await db.Events.CountAsync(
                item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED",
                cancellationToken),
            MemberCount = await db.Users.CountAsync(cancellationToken),
            ActiveMemberCount = await db.Users.CountAsync(
                user => user.Status == "ACTIVE",
                cancellationToken),
            ProductCount = await db.Products.CountAsync(cancellationToken),
            ActiveProductCount = await db.Products.CountAsync(
                product => product.IsActive,
                cancellationToken),
            TodayOrderCount = await db.StoreOrders.CountAsync(
                order => order.CreatedAt >= today,
                cancellationToken),
            MonthOrderCount = await db.StoreOrders.CountAsync(
                order => order.CreatedAt >= monthStart,
                cancellationToken),
            TodayPaidRevenue = await paidOrders
                .Where(order => order.PaidAt >= today)
                .SumAsync(order => (decimal?)order.TotalAmount, cancellationToken) ?? 0m,
            MonthPaidRevenue = await paidOrders
                .Where(order => order.PaidAt >= monthStart)
                .SumAsync(order => (decimal?)order.TotalAmount, cancellationToken) ?? 0m,
            AveragePaidOrderAmount = paidOrderCount == 0
                ? 0m
                : (await paidOrders.SumAsync(order => (decimal?)order.TotalAmount, cancellationToken) ?? 0m)
                    / paidOrderCount,
            UsedCouponCount = await db.UserCoupons.CountAsync(
                coupon => coupon.Status == "USED",
                cancellationToken),
            PointTransactionCount = await db.PointTransactions.CountAsync(cancellationToken),
            RecentOrderTrend = trend,
            OrderStatuses = orderStatuses,
            HotProducts = hotProducts,
            IsAuthenticated = User.Identity?.IsAuthenticated == true,
            IsAdmin = User.IsInRole("Admin"),
            MemberDisplayName = User.Identity?.Name ?? "會員"
        };

        return View(model);
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
