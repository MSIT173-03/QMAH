using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QMAH.Infrastructure.Configuration;

namespace QMAH.Api.Controllers.V1;

[AllowAnonymous]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/v1/navigation")]
public sealed class NavigationController(IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("admin")]
    // 固定站台轉址不讀取管理資料；由後台執行登入及角色驗證，避免過期票證停在 401 JSON。
    public IActionResult Admin() => Redirect(QmahSiteNavigation.GetTarget(
        configuration, "Backend:AdminUrl", environment.IsDevelopment(),
        QmahSiteNavigation.GetRequestHost(Request, environment.IsDevelopment())));
}
