using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
public class HomeController : Controller
{
    public IActionResult Index() => View();
}