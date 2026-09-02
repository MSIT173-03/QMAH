using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供四種 Mini Game 共用的模式、嘗試與獎勵結算 API。</summary>
[Authorize]
[Route("api/v1/game")]
public sealed class MiniGameController(
    MiniGameService miniGameService,
    EconomyService economyService,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    /// <summary>取得目前啟用的 Mini Game 模式與評分門檻。</summary>
    [HttpGet("modes")]
    public async Task<ActionResult<IReadOnlyList<MiniGameModeDto>>> GetModes(
        CancellationToken cancellationToken = default)
    {
        var modes = await miniGameService.GetModesAsync(cancellationToken);
        return Ok(modes.Select(mode => new MiniGameModeDto(
            mode.Id,
            mode.Code,
            mode.Name,
            mode.Description,
            mode.ConfigJson,
            mode.GradeBThreshold,
            mode.GradeAThreshold,
            mode.GradeSThreshold)).ToList());
    }

    /// <summary>開始一次 Mini Game，並由伺服器決定文物、素材池、難度與種子。</summary>
    [HttpPost("attempts")]
    public async Task<ActionResult<MiniGameStartDto>> StartAttempt(
        StartMiniGameRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await miniGameService.StartAttemptAsync(userId, request.ModeCode, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return CreatedAtAction(
            nameof(StartAttempt),
            new { id = value.AttemptId },
            ToStartDto(value));
    }

    /// <summary>完成一次 Mini Game，由伺服器重新計算等級與經濟獎勵。</summary>
    [HttpPost("attempts/{id:guid}/complete")]
    public async Task<ActionResult<MiniGameCompleteDto>> CompleteAttempt(
        Guid id,
        CompleteMiniGameRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await miniGameService.CompleteAttemptAsync(
            userId,
            id,
            request.RawScore,
            request.RawResultJson,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(ToCompleteDto(result.Value!));
    }

    /// <summary>結算目前會員在多人主遊戲中的一次性經濟獎勵。</summary>
    [HttpPost("rooms/{id:guid}/reward")]
    public async Task<ActionResult<MainGameRewardDto>> RewardMainGame(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var result = await economyService.RewardMainGameAsync(userId, id, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return Ok(new MainGameRewardDto(
            value.PointReward,
            value.NormalKeyReward,
            value.PerformanceScore,
            value.RoundsWon,
            value.AlreadyRewarded));
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

    private MiniGameStartDto ToStartDto(MiniGameStartView value) => new(
        value.AttemptId,
        value.ModeCode,
        value.ModeName,
        value.ArtifactId,
        value.ArtifactName,
        mediaUrlResolver.Resolve(value.PrimaryImagePath) ?? value.PrimaryImagePath,
        mediaUrlResolver.Resolve(value.ThumbnailPath),
        value.ArtifactPool.Select(item => new MiniGameArtifactDto(
            item.ArtifactId,
            item.Name,
            mediaUrlResolver.Resolve(item.PrimaryImagePath) ?? item.PrimaryImagePath,
            mediaUrlResolver.Resolve(item.ThumbnailPath))).ToList(),
        value.Difficulty,
        value.Seed,
        value.ConfigJson,
        value.StartedAt);

    private static MiniGameCompleteDto ToCompleteDto(MiniGameCompleteView value) => new(
        value.AttemptId,
        value.ModeCode,
        value.RawScore,
        value.NormalizedScore,
        value.Grade,
        value.PointReward,
        value.KeyProgressReward,
        value.ConvertedNormalKeys,
        value.RemainingKeyProgress,
        value.EconomicRewardGranted,
        value.AlreadyCompleted,
        value.CompletedAt);
}
