using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Catalog.Controllers;

public class KeyBackpack : Controller
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
