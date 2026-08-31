using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using QMAH.Web.Infrastructure;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;


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
    public async Task<IActionResult> Index(int page = 0, int rows = 20)
    {
        bool isOverShot = page < 0 || rows < 0 || this.db.StoreOrders.Count() < page * rows;
        if (isOverShot) return View(new List<OrderSimplefyListItem>());

        var query = from order in this.db.StoreOrders.Skip(page * rows).Take(rows)
                    join user in this.db.Users on order.UserId equals user.Id
                    join items in this.db.OrderDetails on order.Id equals items.OrderId into itemsGroup
                    select new
                    {
                        Order = order,
                        User = user,
                        Items = itemsGroup,
                    };
        var data = query
            .Select(static v => new OrderSimplefyListItem(v.Order, v.User, v.Items.ToList()))
            .ToList();

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
        [FromQuery(Name = "order[0][column]")] int orderColumn = 7,
        [FromQuery(Name = "order[0][dir]")] string? orderDirection = "desc",
        CancellationToken cancellationToken = default)
    {
        var query = from order in db.StoreOrders.AsNoTracking()
                    join user in db.Users.AsNoTracking() on order.UserId equals user.Id
                    select new
                    {
                        Order = order,
                        UserName = user.UserName ?? string.Empty
                    };

        var recordsTotal = await db.StoreOrders.CountAsync(cancellationToken);
        var search = searchValue?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(row => row.Order.OrderNo.Contains(search)
                || row.UserName.Contains(search)
                || row.Order.Status.Contains(search));
        }

        var recordsFiltered = await query.CountAsync(cancellationToken);
        var descending = string.Equals(orderDirection, "desc", StringComparison.OrdinalIgnoreCase);
        var ordered = orderColumn switch
        {
            0 => descending ? query.OrderByDescending(row => row.Order.OrderNo) : query.OrderBy(row => row.Order.OrderNo),
            1 => descending ? query.OrderByDescending(row => row.UserName) : query.OrderBy(row => row.UserName),
            2 => descending ? query.OrderByDescending(row => row.Order.Status) : query.OrderBy(row => row.Order.Status),
            3 => descending ? query.OrderByDescending(row => db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id)) : query.OrderBy(row => db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id)),
            4 => descending ? query.OrderByDescending(row => row.Order.Subtotal) : query.OrderBy(row => row.Order.Subtotal),
            5 => descending ? query.OrderByDescending(row => row.Order.DiscountAmount) : query.OrderBy(row => row.Order.DiscountAmount),
            6 => descending ? query.OrderByDescending(row => row.Order.PointsUsed) : query.OrderBy(row => row.Order.PointsUsed),
            7 => descending ? query.OrderByDescending(row => row.Order.TotalAmount) : query.OrderBy(row => row.Order.TotalAmount),
            9 => descending ? query.OrderByDescending(row => row.Order.PaidAt) : query.OrderBy(row => row.Order.PaidAt),
            10 => descending ? query.OrderByDescending(row => row.Order.CancelledAt) : query.OrderBy(row => row.Order.CancelledAt),
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
                db.OrderDetails.Count(detail => detail.OrderId == row.Order.Id),
                row.Order.Subtotal,
                row.Order.DiscountAmount,
                row.Order.PointsUsed,
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
                row.ItemsCount,
                Subtotal = row.Subtotal.ToString("C0"),
                DiscountAmount = row.DiscountAmount.ToString("C0"),
                PointsUsed = row.PointsUsed.ToString("N0"),
                TotalAmount = row.TotalAmount.ToString("C0"),
                CreatedAt = row.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
                PaidAt = row.PaidAt?.ToString("yyyy-MM-dd HH:mm") ?? "—",
                CancelledAt = row.CancelledAt?.ToString("yyyy-MM-dd HH:mm") ?? "—",
                ActionUrl = Url.Action(nameof(GetOrder), new { id = row.Id })
            })
        });
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var query = from order in this.db.StoreOrders
                    join user in this.db.Users on order.UserId equals user.Id
                    where order.Id == id
                    select new
                    {
                        Name = user.UserName,
                        Order = order
                    };
        var res = query.FirstOrDefault();
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
        var list = queryItems.ToList();
        if (list == null) list = [];

        var detail = new OrderFullDetail(res.Order, res.Name, list);

        return View(detail);
    }

    [HttpGet("Create")]
    public async Task<IActionResult> Create()
    {
        return View("OrderModifyForm", new OrderCreateData());
    }

    [HttpGet("AppendItems/{id:Guid}")]
    public async Task<IActionResult> AppendOrderItems(Guid id)
    {
        ViewData["ActionName"] = "AppendItems";
        ViewData["TargetGuid"] = id.ToString();
        return View("OrderDetailsModifyForm");
    }

    [HttpPost("AppendItems")]
    public async Task<IActionResult> AppendOrderItems([FromForm] OrderDetailAppendData data)
    {
        var target = this.db.StoreOrders.Where(v => v.Id == data.Id).FirstOrDefault();
        if (target == null)
        {
            HttpContext.Response.StatusCode = 404;
            return Json(new OrderDetailAppendDataResponse()
            {
                Type = OrderDetailAppendDataResponse.EResultType.ErrorOrderNotFound,
                List = [],
            });
        }

        var query = from prod in this.db.Products
                    from list in data.List
                    where prod.Id == list.Id && prod.Stock >= list.Amount
                    select new
                    {
                        Id = prod.Id,
                        Name = prod.Name,
                        Price = prod.Price,
                        Amount = list.Amount,
                    };
        var ls = query.ToList();

        foreach (var item in query)
        {
            OrderDetail detail = new OrderDetail()
            {
                OrderId = data.Id,
                ProductId = item.Id,
                ProductNameSnapshot = item.Name,
                UnitPrice = item.Price,
                Quantity = item.Amount,
                LineTotal = item.Amount * item.Price,
            };

            this.db.OrderDetails.Add(detail);
        }

        this.db.SaveChanges();


        return Json(new OrderDetailAppendDataResponse()
        {
            Type = OrderDetailAppendDataResponse.EResultType.Success,
            List = ls.Select(v => new OrderDetailAppendDataResponse.Data { Id = v.Id, Name = v.Name }).ToList(),
        });
    }

    [HttpPost("Cancel")]
    public async Task<IActionResult> SetCancel([FromForm] Guid id)
    {
        try
        {
            var order = this.db.StoreOrders.Where(o => o.Id == id).FirstOrDefault();
            if (order == null)
            {
                HttpContext.Response.StatusCode = 404;
                return Json(new OrderCancelResult
                {
                    Type = OrderCancelResult.EResultType.ErrorNotFound
                });
            }

            if (order.CancelledAt != null)
            {
                HttpContext.Response.StatusCode = 409;
                return Json(new OrderCancelResult
                {
                    Type = OrderCancelResult.EResultType.ErrorCancelled,
                });
            }

            order.CancelledAt = DateTime.Now;
            order.Status = "CANCELLED";

            this.db.StoreOrders.Update(order);
            this.db.SaveChanges();

            return Json(new OrderCancelResult
            {
                Type = OrderCancelResult.EResultType.Success
            });
        }
        catch (Exception ex)
        {
            HttpContext.Response.StatusCode = 500;
            return Json(new OrderCancelResult
            {
                Type = OrderCancelResult.EResultType.ErrorOtherException,
                Message = ex.Message
            });
        }
    }

    private sealed record OrderDataRow(
        Guid Id,
        string OrderNo,
        string UserName,
        string Status,
        int ItemsCount,
        decimal Subtotal,
        decimal DiscountAmount,
        int PointsUsed,
        decimal TotalAmount,
        DateTime CreatedAt,
        DateTime? PaidAt,
        DateTime? CancelledAt);
}
