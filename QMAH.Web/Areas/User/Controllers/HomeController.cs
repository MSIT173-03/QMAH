using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public class HomeController : Controller
{
    public IActionResult Index() => View();
}