using System.Security.Claims;

using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Services.Economy;

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

    /// <summary>把經濟服務（EconomyService 等）回傳的失敗結果轉成對應狀態碼的 ProblemDetails，detail 為可直接顯示的說明。</summary>
    protected ActionResult ToFailure<T>(EconomyResult<T> result) => result.ErrorCode switch
    {
        "NOT_FOUND" => Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "找不到資源",
            detail: result.ErrorMessage),
        "FORBIDDEN" => Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "沒有執行此操作的權限",
            detail: result.ErrorMessage),
        "CONFLICT" => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "目前狀態不允許此操作",
            detail: result.ErrorMessage),
        _ => Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "請求資料無效",
            detail: result.ErrorMessage)
    };
}
