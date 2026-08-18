using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public sealed class HomeController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var model = new StoreDashboardViewModel
        {
            ProductCount = await db.Products.CountAsync(cancellationToken),
            ActiveProductCount = await db.Products.CountAsync(
                product => product.IsActive,
                cancellationToken),
            LowStockProductCount = await db.Products.CountAsync(
                product => product.IsActive && product.Stock <= 5,
                cancellationToken),
            OrderCount = await db.StoreOrders.CountAsync(cancellationToken),
            PendingOrderCount = await db.StoreOrders.CountAsync(
                order => order.Status == "PENDING_PAYMENT" || order.Status == "FULFILLING",
                cancellationToken),
            CouponCount = await db.CouponDefinitions.CountAsync(cancellationToken),
            SuccessfulPaymentCount = await db.Payments.CountAsync(
                payment => payment.Status == "PAID",
                cancellationToken),
            RecentOrders = await (
                from order in db.StoreOrders.AsNoTracking()
                join user in db.Users.AsNoTracking() on order.UserId equals user.Id
                orderby order.CreatedAt descending
                select new StoreDashboardOrderItem
                {
                    Id = order.Id,
                    OrderNo = order.OrderNo,
                    Status = order.Status,
                    TotalAmount = order.TotalAmount,
                    CreatedAt = order.CreatedAt,
                    CustomerName = user.UserName ?? user.Email ?? "會員"
                })
                .Take(6)
                .ToListAsync(cancellationToken)
        };

        ViewData["AdminDescription"] = "商品、訂單、付款與庫存狀態的共同入口。";
        return View(model);
    }
}
