using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[Authorize(Policy = "Policy.Social.ManageReports")]
public sealed class PostsController : Controller
{
    [HttpGet]
    public IActionResult Index() => RedirectToAction("Index", "SocialPostAdmin", new { area = "Social" })!;

    [HttpGet]
    public IActionResult Create() => RedirectToAction("Index", "SocialPostAdmin", new { area = "Social" })!;
}
