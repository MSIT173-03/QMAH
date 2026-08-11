using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
public class HomeController : Controller
{
    public IActionResult Index() => View();
}