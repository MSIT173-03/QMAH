using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}