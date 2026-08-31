using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

[Authorize(Roles = "Admin")]
[Route("api/v1/admin/dashboard")]
public sealed class AdminDashboardController(QmahDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> GetDashboard(
        CancellationToken cancellationToken = default)
    {
        var paidStatuses = new[] { "PAID", "FULFILLING", "SHIPPED", "COMPLETED" };
        var paidOrders = db.StoreOrders
            .AsNoTracking()
            .Where(order => paidStatuses.Contains(order.Status));
        var today = DateTime.UtcNow.Date;
        var trendStart = today.AddDays(-13);

        var trendRows = await paidOrders
            .Where(order => order.CreatedAt >= trendStart)
            .GroupBy(order => order.CreatedAt.Date)
            .Select(group => new { Date = group.Key, Orders = group.Count(), Revenue = group.Sum(order => order.TotalAmount) })
            .ToListAsync(cancellationToken);
        var orderTrend = Enumerable.Range(0, 14)
            .Select(offset =>
            {
                var date = trendStart.AddDays(offset);
                var row = trendRows.SingleOrDefault(item => item.Date == date);
                return new DashboardTrendDto(date, row?.Orders ?? 0, row?.Revenue ?? 0m);
            })
            .ToList();

        var hotProducts = await db.OrderDetails
            .AsNoTracking()
            .Where(detail => paidStatuses.Contains(detail.Order.Status))
            .GroupBy(detail => new { detail.ProductId, detail.ProductNameSnapshot })
            .OrderByDescending(group => group.Sum(detail => detail.Quantity))
            .ThenBy(group => group.Key.ProductNameSnapshot)
            .Take(10)
            .Select(group => new DashboardProductDto(
                group.Key.ProductId,
                group.Key.ProductNameSnapshot,
                group.Sum(detail => detail.Quantity),
                group.Sum(detail => detail.LineTotal)))
            .ToListAsync(cancellationToken);

        var dashboard = new DashboardDto(
            await db.Users.CountAsync(cancellationToken),
            await db.Users.CountAsync(user => user.Status == "ACTIVE", cancellationToken),
            await db.Artifacts.CountAsync(cancellationToken),
            await db.ArtifactQuestionEntries.CountAsync(question => question.IsEnabled, cancellationToken),
            await db.SocialPosts.CountAsync(cancellationToken),
            await db.SocialComments.CountAsync(cancellationToken),
            await db.Events.CountAsync(cancellationToken),
            await db.GameRooms.CountAsync(cancellationToken),
            await db.Products.CountAsync(product => product.IsActive, cancellationToken),
            await db.ContentReports.CountAsync(report => report.Status == "PENDING", cancellationToken),
            await db.CouponDefinitions.CountAsync(cancellationToken),
            await db.PointTransactions.CountAsync(cancellationToken),
            await db.StoreOrders.CountAsync(cancellationToken),
            await paidOrders.SumAsync(order => order.TotalAmount, cancellationToken),
            orderTrend,
            await db.StoreOrders
                .AsNoTracking()
                .GroupBy(order => order.Status)
                .OrderBy(group => group.Key)
                .Select(group => new DashboardStatusDto(group.Key, group.Count()))
                .ToListAsync(cancellationToken),
            hotProducts);

        return Ok(dashboard);
    }
}
