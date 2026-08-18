using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Store.Controllers;

public class CouponController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}
