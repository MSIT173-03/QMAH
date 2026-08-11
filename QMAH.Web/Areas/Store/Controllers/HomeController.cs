using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
public class HomeController : Controller
{
    public IActionResult Index() => View();
}