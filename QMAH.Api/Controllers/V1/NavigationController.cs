using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QMAH.Infrastructure.Configuration;

namespace QMAH.Api.Controllers.V1;

[Authorize(Roles = "Admin")]
[Route("api/v1/navigation")]
public sealed class NavigationController(IConfiguration configuration) : ControllerBase
{
    [HttpGet("admin")]
    public IActionResult Admin() => Redirect(QmahSiteNavigation.GetTarget(configuration, "Backend:AdminUrl"));
}
