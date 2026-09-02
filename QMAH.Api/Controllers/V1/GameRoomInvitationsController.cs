using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供私人房間邀請與會員加碼規則的 API。</summary>
[Authorize]
[Route("api/v1/game")]
public sealed class GameRoomInvitationsController(
    GameRoomInvitationService invitationService,
    CommunityRewardService communityRewardService) : ApiControllerBase
{
    /// <summary>取得目前會員收到的私人房間邀請與其處理結果。</summary>
    [HttpGet("invitations")]
    public async Task<ActionResult<IReadOnlyList<GameRoomInvitationDto>>> GetReceivedInvitations(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var invitations = await invitationService.GetReceivedAsync(userId, cancellationToken);
        return Ok(invitations.Select(ToDto).ToList());
    }

    /// <summary>取得指定私人房間由目前房主送出的邀請。</summary>
    [HttpGet("rooms/{roomId:guid}/invitations")]
    public async Task<ActionResult<IReadOnlyList<GameRoomInvitationDto>>> GetSentInvitations(
        Guid roomId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await invitationService.GetSentAsync(userId, roomId, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(result.Value!.Select(ToDto).ToList());
    }

    /// <summary>邀請一位啟用中的會員加入私人房間。</summary>
    [HttpPost("rooms/{roomId:guid}/invitations")]
    public async Task<ActionResult<GameRoomInvitationDto>> CreateInvitation(
        Guid roomId,
        CreateGameRoomInvitationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await invitationService.CreateAsync(
            userId,
            roomId,
            new CreateGameRoomInvitationInput(request.InviteeUserId, request.Message),
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(ToDto(result.Value!));
    }

    /// <summary>接受或拒絕目前會員收到的私人房間邀請。</summary>
    [HttpPost("invitations/{invitationId:guid}/response")]
    public async Task<ActionResult<GameRoomInvitationDto>> RespondInvitation(
        Guid invitationId,
        RespondGameRoomInvitationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await invitationService.RespondAsync(
            userId,
            invitationId,
            new RespondGameRoomInvitationInput(request.Decision, request.DisplayName),
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(ToDto(result.Value!));
    }

    /// <summary>取消目前會員送出的待處理私人房間邀請。</summary>
    [HttpPost("invitations/{invitationId:guid}/cancel")]
    public async Task<ActionResult<GameRoomInvitationDto>> CancelInvitation(
        Guid invitationId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await invitationService.CancelAsync(userId, invitationId, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(ToDto(result.Value!));
    }

    /// <summary>取得私人房間目前的會員加碼規則。</summary>
    [HttpGet("rooms/{roomId:guid}/reward-policy")]
    public async Task<ActionResult<CommunityRewardPolicyDto?>> GetRoomRewardPolicy(
        Guid roomId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await communityRewardService.GetRoomPolicyAsync(userId, roomId, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(result.Value is null ? null : ToDto(result.Value));
    }

    /// <summary>設定私人房間的點數與鑰匙加碼上限；填入兩種加碼皆為 0 可停用規則。</summary>
    [HttpPut("rooms/{roomId:guid}/reward-policy")]
    public async Task<ActionResult<CommunityRewardPolicyDto?>> ConfigureRoomRewardPolicy(
        Guid roomId,
        ConfigureCommunityRewardRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await communityRewardService.ConfigureRoomAsync(
            userId,
            roomId,
            ToConfiguration(request),
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

    private static CommunityRewardConfiguration ToConfiguration(ConfigureCommunityRewardRequest request) =>
        new(
            request.PointPerRecipient,
            request.KeyDefinitionId,
            request.KeyPerRecipient,
            request.PointBudget,
            request.KeyBudget,
            request.ValidFrom,
            request.ValidUntil);

    private static GameRoomInvitationDto ToDto(GameRoomInvitationView value) => new(
        value.Id,
        value.RoomId,
        value.RoomCode,
        value.Status,
        value.InviterUserId,
        value.InviterDisplayName,
        value.InviteeUserId,
        value.InviteeDisplayName,
        value.Message,
        value.RewardCampaignId,
        value.RewardPointAmount,
        value.RewardKeyDefinitionId,
        value.RewardKeyCode,
        value.RewardKeyName,
        value.RewardKeyAmount,
        value.RewardGrantedAt,
        value.CreatedAt,
        value.RespondedAt);

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
