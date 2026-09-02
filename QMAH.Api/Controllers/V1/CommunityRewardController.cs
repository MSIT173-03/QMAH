using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供公開活動加碼規則查詢與活動主辦設定的 API。</summary>
[Route("api/v1/social")]
public sealed class CommunityRewardController(CommunityRewardService communityRewardService) : ApiControllerBase
{
    /// <summary>取得活動目前的參與加碼規則與剩餘額度。</summary>
    [AllowAnonymous]
    [HttpGet("events/{eventId:guid}/reward-policy")]
    public async Task<ActionResult<CommunityRewardPolicyDto?>> GetEventRewardPolicy(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        var policy = await communityRewardService.GetEventPolicyAsync(eventId, cancellationToken);
        return Ok(policy is null ? null : ToDto(policy));
    }

    /// <summary>設定活動的參與加碼規則；官方活動由管理員提供且不扣個人資產。</summary>
    [Authorize]
    [HttpPut("events/{eventId:guid}/reward-policy")]
    public async Task<ActionResult<CommunityRewardPolicyDto?>> ConfigureEventRewardPolicy(
        Guid eventId,
        ConfigureCommunityRewardRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await communityRewardService.ConfigureEventAsync(
            userId,
            eventId,
            User.IsInRole("Admin"),
            new CommunityRewardConfiguration(
                request.PointPerRecipient,
                request.KeyDefinitionId,
                request.KeyPerRecipient,
                request.PointBudget,
                request.KeyBudget,
                request.ValidFrom,
                request.ValidUntil),
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(result.Value is null ? null : ToDto(result.Value));
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

    private static CommunityRewardPolicyDto ToDto(CommunityRewardPolicyView value) => new(
        value.Id,
        value.TargetType,
        value.EventId,
        value.GameRoomId,
        value.SponsorType,
        value.BudgetMode,
        value.PointPerRecipient,
        value.KeyDefinitionId,
        value.KeyCode,
        value.KeyName,
        value.KeyPerRecipient,
        value.PointBudget,
        value.RemainingPointBudget,
        value.PointIssued,
        value.KeyBudget,
        value.RemainingKeyBudget,
        value.KeyIssued,
        value.ValidFrom,
        value.ValidUntil,
        value.IsActive,
        value.UpdatedAt);
}
