using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Catalog.Controllers;

public class KeyBackpackController : Controller
{

    public IActionResult List()
    {
        return View();
    }


    public IActionResult Unlocked()
    {
        return View();
    }
}
