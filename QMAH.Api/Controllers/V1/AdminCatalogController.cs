using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供管理員處理會員圖鑑解鎖的 API。</summary>
[Authorize(Roles = "Admin")]
[Route("api/v1/admin/catalog")]
public sealed class AdminCatalogController(EconomyService economyService) : ApiControllerBase
{
    /// <summary>替指定會員強制解鎖一件啟用中的文物；重複呼叫不會建立第二筆解鎖紀錄。</summary>
    [HttpPost("members/{userId:guid}/artifacts/{artifactId:guid}/unlock")]
    public async Task<ActionResult<AdminArtifactUnlockDto>> ForceUnlockArtifact(
        Guid userId,
        Guid artifactId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var adminUserId))
            return Unauthorized();

        var result = await economyService.ForceUnlockArtifactAsync(
            adminUserId,
            userId,
            artifactId,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);

        var value = result.Value!;
        return Ok(new AdminArtifactUnlockDto(
            value.UserId,
            value.ArtifactId,
            value.Created,
            value.UnlockMethod,
            value.UnlockedAt));
    }

    private ActionResult ToFailure<T>(EconomyResult<T> result) => result.ErrorCode switch
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
