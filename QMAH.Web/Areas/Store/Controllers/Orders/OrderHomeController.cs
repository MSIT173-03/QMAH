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
        StoreOrder? order = this._db.StoreOrders.FirstOrDefault(v => v.Id == id);
        if (order == null)
        {
            return RedirectToAction("Index");
        }

        return View(order);
    }
}
