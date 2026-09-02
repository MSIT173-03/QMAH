using System.Security.Claims;

using Microsoft.AspNetCore.Mvc;

namespace QMAH.Api.Controllers.V1;

[ApiController]
// [Produces("application/json")] // 棄用：全域限制會讓 ProblemDetails 無法使用標準 media type。
[AutoValidateAntiforgeryToken]
public abstract class ApiControllerBase : ControllerBase
{
    protected bool TryGetCurrentUserId(out Guid userId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    protected ActionResult MissingResource(string title, string detail) =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: title, detail: detail);

    protected ActionResult InvalidWorkflow(string title, string detail) =>
        Problem(statusCode: StatusCodes.Status409Conflict, title: title, detail: detail);
}
