using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;


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
                             Price = product.Price,
                             ProductId = product.Id,
                             ProductName = product.Name,
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
}
