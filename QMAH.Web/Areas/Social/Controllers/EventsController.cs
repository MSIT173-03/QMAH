using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[Authorize(Policy = "Policy.Social.ManageEvents")]
public sealed class EventsController : Controller
{
    [HttpGet]
    public IActionResult Index() => RedirectToAction("Index", "SocialEventAdmin", new { area = "Social" })!;

    [HttpGet]
    public IActionResult Create() => RedirectToAction("Index", "SocialEventAdmin", new { area = "Social" })!;
}
