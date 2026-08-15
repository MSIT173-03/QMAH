using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;



namespace QMAH.Web.Areas.Store.Controllers.Orders;

[Area("Store")]
[Route("store/order")]
public class OrderHomeController : Controller
{
    private readonly QmahDbContext _db;

    public OrderHomeController(QmahDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(int page = 0, int rows = 20)
    {
        bool isOverShot = this._db.StoreOrders.Count() < page * rows;
        if (isOverShot) page = 0;

        var query = from order in this._db.StoreOrders.Skip(page * rows).Take(rows)
                 join user in this._db.Users on order.UserId equals user.Id
                 join items in this._db.OrderDetails on order.Id equals items.OrderId into itemsGroup
                    select new
                 {
                        Order = order,
                        User = user,
                        Items = itemsGroup,
                 };
        var data = query
            .Select(static v => new OrderSimplefyListItem(v.Order, v.User, v.Items.ToList()))
            .ToList();

        return View(data);
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var query = from order in this._db.StoreOrders
                    join user in this._db.Users on order.UserId equals user.Id
                    where order.Id == id
                    select new
                    {
                        Name = user.UserName,
                        Order = order
                    };
        var res = query.FirstOrDefault();
        if (res == null) return RedirectToAction("Index");

        var queryItems = from items in this._db.OrderDetails
                         join product in this._db.Products on items.ProductId equals product.Id
                         where items.OrderId == res.Order.Id
                         select new OrderItemSimplefyData
        {
                             Id = items.Id,
                             Amount = items.Quantity,
                             Price = product.Price,
                             ImageUrl = product.PrimaryImagePath ?? string.Empty,

                         };
        var list = queryItems.ToList();
        if (list == null) list = [];

        var detail = new OrderFullDetail(res.Order, res.Name, list);

        return View(detail);
        }

        return View(order);
    [HttpPost("Cancel")]
    public async Task<IActionResult> SetCancel([FromForm] Guid id)
    {
        try
        {
            var order = this._db.StoreOrders.Where(o => o.Id == id).FirstOrDefault();
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

            this._db.StoreOrders.Update(order);
            this._db.SaveChanges();

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
