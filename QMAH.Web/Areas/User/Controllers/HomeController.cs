using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public class HomeController : Controller
{
    public IActionResult Index() => View();
}