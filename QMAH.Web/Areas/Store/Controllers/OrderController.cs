using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using QMAH.Web.Infrastructure;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Services.Store;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[Route("store/order")]
[AdminNavigation("訂單管理", 20)]
public class OrderController : Controller
{
    private readonly QmahDbContext db;

    public OrderController(QmahDbContext db)
    {
        this.db = db;
    }

    [HttpGet]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(int page = 0, int rows = 20, CancellationToken cancellationToken = default)
    {
        bool isOverShot = page < 0 || rows is <= 0 or > 100
            || await this.db.StoreOrders.CountAsync(cancellationToken) < page * rows;
        if (isOverShot) return View(new List<OrderSimplefyListItem>());

        var query = from order in this.db.StoreOrders.Include(item => item.Payment)
                        .OrderByDescending(item => item.CreatedAt).ThenBy(item => item.Id)
                        .Skip(page * rows).Take(rows)
                    join user in this.db.Users on order.UserId equals user.Id
                    join items in this.db.OrderDetails on order.Id equals items.OrderId into itemsGroup
                    select new
                    {
                        Order = order,
                        User = user,
                        Items = itemsGroup,
                    };
        var data = await query
            .Select(static v => new OrderSimplefyListItem(v.Order, v.User, v.Items.ToList()))
            .ToListAsync(cancellationToken);

        ViewData["Page"] = page;
        ViewData["Rows"] = rows;

        return View(data);
    }

    [HttpGet("data")]
    public async Task<IActionResult> Data(
        int draw = 1,
        int start = 0,
        int length = 20,
        [FromQuery(Name = "search[value]")] string? searchValue = null,
        [FromQuery(Name = "order[0][column]")] int orderColumn = 12,
        [FromQuery(Name = "order[0][dir]")] string? orderDirection = "desc",
        CancellationToken cancellationToken = default)
    {
        var query = from order in db.StoreOrders.AsNoTracking()
                    join user in db.Users.AsNoTracking() on order.UserId equals user.Id
                    join payment in db.Payments.AsNoTracking() on order.Id equals payment.OrderId into payments
                    from payment in payments.DefaultIfEmpty()
                    select new
                    {
                        Order = order,
                        UserName = user.UserName ?? string.Empty,
                        PaymentType = payment == null ? null : payment.PaymentType,
                        PaymentStatus = payment == null ? null : payment.Status
                    };

        var recordsTotal = await db.StoreOrders.CountAsync(cancellationToken);
        var search = searchValue?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(row => row.Order.OrderNo.Contains(search)
                || row.UserName.Contains(search)
                || row.Order.Status.Contains(search)
                || (row.PaymentType != null && row.PaymentType.Contains(search))
                || (row.PaymentStatus != null && row.PaymentStatus.Contains(search)));
        }

        var recordsFiltered = await query.CountAsync(cancellationToken);
        var descending = string.Equals(orderDirection, "desc", StringComparison.OrdinalIgnoreCase);
        var ordered = orderColumn switch
        {
            0 => descending ? query.OrderByDescending(row => row.Order.OrderNo) : query.OrderBy(row => row.Order.OrderNo),
            1 => descending ? query.OrderByDescending(row => row.UserName) : query.OrderBy(row => row.UserName),
            2 => descending ? query.OrderByDescending(row => row.Order.Status) : query.OrderBy(row => row.Order.Status),
            3 => descending ? query.OrderByDescending(row => row.PaymentType) : query.OrderBy(row => row.PaymentType),
            4 => descending ? query.OrderByDescending(row => row.PaymentStatus) : query.OrderBy(row => row.PaymentStatus),
            5 => descending ? query.OrderByDescending(row => db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id)) : query.OrderBy(row => db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id)),
            6 => descending ? query.OrderByDescending(row => row.Order.Subtotal) : query.OrderBy(row => row.Order.Subtotal),
            7 => descending ? query.OrderByDescending(row => row.Order.DiscountAmount) : query.OrderBy(row => row.Order.DiscountAmount),
            8 => descending ? query.OrderByDescending(row => row.Order.PointsUsed) : query.OrderBy(row => row.Order.PointsUsed),
            9 => descending ? query.OrderByDescending(row => row.Order.ShippingMethod) : query.OrderBy(row => row.Order.ShippingMethod),
            10 => descending ? query.OrderByDescending(row => row.Order.ShippingFee) : query.OrderBy(row => row.Order.ShippingFee),
            11 => descending ? query.OrderByDescending(row => row.Order.TotalAmount) : query.OrderBy(row => row.Order.TotalAmount),
            13 => descending ? query.OrderByDescending(row => row.Order.PaidAt) : query.OrderBy(row => row.Order.PaidAt),
            14 => descending ? query.OrderByDescending(row => row.Order.CancelledAt) : query.OrderBy(row => row.Order.CancelledAt),
            _ => descending ? query.OrderByDescending(row => row.Order.CreatedAt) : query.OrderBy(row => row.Order.CreatedAt)
        };

        var pageSize = length is > 0 and <= 100 ? length : 20;
        var offset = Math.Max(0, start);
        var rows = await ordered
            .ThenBy(row => row.Order.Id)
            .Skip(offset)
            .Take(pageSize)
            .Select(row => new OrderDataRow(
                row.Order.Id,
                row.Order.OrderNo,
                row.UserName,
                row.Order.Status,
                row.PaymentType,
                row.PaymentStatus,
                db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id),
                row.Order.Subtotal,
                row.Order.DiscountAmount,
                row.Order.PointsUsed,
                row.Order.ShippingMethod,
                row.Order.ShippingFee,
                row.Order.TotalAmount,
                row.Order.CreatedAt,
                row.Order.PaidAt,
                row.Order.CancelledAt))
            .ToListAsync(cancellationToken);

        return Json(new
        {
            draw = Math.Max(0, draw),
            recordsTotal,
            recordsFiltered,
            data = rows.Select(row => new
            {
                row.Id,
                row.OrderNo,
                row.UserName,
                Status = AdminDisplayLabels.Status(row.Status),
                PaymentType = AdminDisplayLabels.PaymentType(row.PaymentType),
                PaymentStatus = AdminDisplayLabels.PaymentStatus(row.PaymentStatus),
                row.ItemsCount,
                Subtotal = row.Subtotal.ToString("C0"),
                DiscountAmount = row.DiscountAmount.ToString("C0"),
                PointsUsed = row.PointsUsed.ToString("N0"),
                ShippingMethod = AdminDisplayLabels.ShippingMethod(row.ShippingMethod),
                ShippingFee = row.ShippingFee.ToString("C0"),
                TotalAmount = row.TotalAmount.ToString("C0"),
                CreatedAt = row.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                PaidAt = row.PaidAt?.ToString("yyyy-MM-dd HH:mm") ?? "—",
                CancelledAt = row.CancelledAt?.ToString("yyyy-MM-dd HH:mm") ?? "—",
                ActionUrl = Url.Action(nameof(GetOrder), new { id = row.Id })
            })
        });
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetOrder(Guid id, CancellationToken cancellationToken)
    {
        var query = from order in this.db.StoreOrders.Include(order => order.Payment)
                    join user in this.db.Users on order.UserId equals user.Id
                    where order.Id == id
                    select new
                    {
                        Name = user.UserName,
                        Order = order
                    };
        var res = await query.FirstOrDefaultAsync(cancellationToken);
        if (res == null) return RedirectToAction("Index");

        var queryItems = from items in this.db.OrderDetails
                         join product in this.db.Products on items.ProductId equals product.Id
                         where items.OrderId == res.Order.Id
                         select new OrderItemSimplefyData
                         {
                             Id = items.Id,
                             Amount = items.Quantity,
                             // 訂單明細保存成交當下的快照，不能回讀商品目前價格。
                             Price = items.UnitPrice,
                             ProductId = product.Id,
                             ProductName = items.ProductNameSnapshot,
                         };
        var list = await queryItems.ToListAsync(cancellationToken);

        var detail = new OrderFullDetail(res.Order, res.Name, list);

        return View(detail);
    }

    [HttpPost("{id:Guid}/shipping")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateShipping(Guid id, [FromForm] string shippingMethod, CancellationToken cancellationToken)
    {
        // 已送往金流或已付款的訂單不可改金額；只允許尚未付款的貨到付款訂單調整配送。
        var normalizedMethod = shippingMethod?.Trim().ToUpperInvariant();
        if (normalizedMethod is not ("STANDARD" or "CVS"))
            return BadRequest("請選擇有效的配送方式。");

        var strategy = db.Database.CreateExecutionStrategy();
        var result = await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, retryToken);
            var order = await db.StoreOrders.Include(item => item.Payment)
                .SingleOrDefaultAsync(item => item.Id == id, retryToken);
            if (order is null)
                return (IActionResult)NotFound();
            if (order.Status != "PENDING_PAYMENT" || order.Payment is not { Status: "PENDING", PaymentType: "COD" })
                return Conflict("只有待付款的貨到付款訂單可修改配送方式。");

            // 與結帳選項一致：商品小計滿 1,500 元免運，否則宅配 80 元、超商 60 元。
            var shippingFee = order.Subtotal >= 1500m ? 0m : normalizedMethod == "STANDARD" ? 80m : 60m;
            order.ShippingMethod = normalizedMethod;
            order.ShippingFee = shippingFee;
            order.TotalAmount = order.Subtotal - order.DiscountAmount - order.PointsUsed + shippingFee;
            order.Payment.Amount = order.TotalAmount;

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return RedirectToAction(nameof(GetOrder), new { id });
        }, cancellationToken);

        if (result is RedirectToActionResult)
            TempData["SuccessMessage"] = "配送方式與應付金額已更新。";
        return result;
    }

    [HttpPost("Cancel")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetCancel([FromForm] Guid id, CancellationToken cancellationToken)
    {
        // 信用卡訂單可能已在綠界付款但 callback 尚未到達，後台無法查詢綠界，交給 API 的逾時取消先確認付款狀態。
        var paymentType = await db.StoreOrders.AsNoTracking()
            .Where(order => order.Id == id)
            .Select(order => order.Payment == null ? null : order.Payment.PaymentType)
            .FirstOrDefaultAsync(cancellationToken);
        if (paymentType == "CREDIT_CARD")
            return Conflict("信用卡訂單會在付款逾時後由系統向綠界確認並自動取消，後台不直接取消。");

        var outcome = await StoreOrderCancellation.CancelPendingAsync(db, id, null, cancellationToken);
        return outcome switch
        {
            PendingOrderCancelOutcome.Cancelled => Ok(),
            PendingOrderCancelOutcome.NotFound => NotFound("找不到這筆訂單。"),
            PendingOrderCancelOutcome.AlreadyCancelled => Conflict("這筆訂單已經取消。"),
            PendingOrderCancelOutcome.AlreadyPaid => Conflict("已付款訂單不能直接取消，請走退款流程。"),
            _ => Conflict("只有待付款訂單可以取消。")
        };
    }

    private sealed record OrderDataRow(
        Guid Id,
        string OrderNo,
        string UserName,
        string Status,
        string? PaymentType,
        string? PaymentStatus,
        int ItemsCount,
        decimal Subtotal,
        decimal DiscountAmount,
        int PointsUsed,
        string ShippingMethod,
        decimal ShippingFee,
        decimal TotalAmount,
        DateTime CreatedAt,
        DateTime? PaidAt,
        DateTime? CancelledAt);
}
