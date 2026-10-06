using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供會員經濟狀態、鑰匙、優惠券與配戴稱號的 API。</summary>
[Authorize]
[Route("api/v1/me")]
public sealed class EconomyController(EconomyService economyService) : ApiControllerBase
{
    /// <summary>自動結算目前會員已達門檻的鑰匙進度；重複呼叫不會重複發放。</summary>
    [HttpPost("keys/convert-progress")]
    public async Task<ActionResult<KeyProgressConversionDto>> ConvertKeyProgress(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var result = await economyService.ConvertKeyProgressAsync(userId, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return Ok(new KeyProgressConversionDto(
            value.ConvertedNormalKeys, value.ConsumedKeyProgress,
            value.RemainingKeyProgress, value.KeyProgressToNormalKey));
    }

    /// <summary>取得目前會員的鑑定點數、鑰匙進度、鑰匙餘額與可用兌換規則。</summary>
    [HttpGet("economy")]
    public async Task<ActionResult<MemberEconomyDto>> GetEconomy(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        try
        {
            var economy = await economyService.GetMemberEconomyAsync(userId, cancellationToken);
            return Ok(new MemberEconomyDto(
                economy.PointBalance,
                economy.KeyProgressBalance,
                economy.KeyProgressToNormalKey,
                economy.Keys.Select(ToKeyBalanceDto).ToList(),
                economy.ExchangeRules.Select(ToExchangeRuleDto).ToList()));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // 頁面切換取消讀取時，只結束該次請求，不回傳不完整資產或當成伺服器錯誤。
            return StatusCode(499);
        }
    }

    /// <summary>取得啟用中的鑰匙兌換規則；目標已無可解鎖文物時仍可兌換。</summary>
    [HttpGet("keys/exchange-rules")]
    public async Task<ActionResult<IReadOnlyList<KeyExchangeRuleDto>>> GetKeyExchangeRules(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var rules = await economyService.GetExchangeRulesAsync(userId, cancellationToken);
        return Ok(rules.Select(ToExchangeRuleDto).ToList());
    }

    /// <summary>使用指定類型鑰匙解鎖一件文物，抽選與扣除均由伺服器執行。</summary>
    [HttpPost("keys/{keyCode}/unlock")]
    public async Task<ActionResult<ArtifactUnlockResultDto>> UnlockArtifact(
        string keyCode,
        UnlockArtifactRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await economyService.UnlockArtifactAsync(
            userId,
            keyCode,
            request.ArtifactId,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return Ok(new ArtifactUnlockResultDto(
            value.Unlocked,
            value.ArtifactId,
            value.ArtifactName,
            value.RemainingEligibleArtifactCount,
            value.Message));
    }

    /// <summary>依資料庫兌換規則交換鑰匙，並以同一交易更新來源與目標餘額。</summary>
    [HttpPost("keys/exchange")]
    public async Task<ActionResult<KeyExchangeResultDto>> ExchangeKeys(
        ExchangeKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await economyService.ExchangeKeysAsync(
            userId,
            request.RuleId,
            request.Units,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return Ok(new KeyExchangeResultDto(
            value.RuleId,
            value.SourceKeyCode,
            value.SourceAmount,
            value.TargetKeyCode,
            value.TargetAmount,
            value.TargetEligibleArtifactCount));
    }

    /// <summary>回收已沒有可解鎖文物的鑰匙，並取得鑑定點數。</summary>
    [HttpPost("keys/{keyCode}/recycle")]
    public async Task<ActionResult<KeyRecycleResultDto>> RecycleKey(
        string keyCode,
        RecycleKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await economyService.RecycleKeyAsync(
            userId,
            keyCode,
            request.Amount,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        var value = result.Value!;
        return Ok(new KeyRecycleResultDto(
            value.KeyCode,
            value.KeyAmount,
            value.PointAmount,
            value.RemainingEligibleArtifactCount));
    }

    /// <summary>取得目前可用的鑑定點數兌換優惠券設定。</summary>
    [HttpGet("coupons/exchange-options")]
    public async Task<ActionResult<IReadOnlyList<PointCouponOptionDto>>> GetCouponExchangeOptions(
        CancellationToken cancellationToken = default)
    {
        var options = await economyService.GetPointCouponOptionsAsync(cancellationToken);
        return Ok(options.Select(option => new PointCouponOptionDto(
            option.Id,
            option.Code,
            option.Name,
            option.PointCost,
            option.DiscountType,
            option.DiscountValue,
            option.MinimumAmount,
            option.ValidityDays,
            option.StartAt,
            option.EndAt)).ToList());
    }

    /// <summary>使用鑑定點數兌換一張獨立的會員優惠券。</summary>
    [HttpPost("coupons/redeem")]
    public async Task<ActionResult<RedeemedCouponDto>> RedeemCoupon(
        RedeemCouponRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await economyService.RedeemPointCouponAsync(
            userId,
            request.CouponDefinitionId,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        return Ok(ToCouponDto(result.Value!));
    }

    /// <summary>取得目前會員配戴的成就稱號；未配戴時回傳 null。</summary>
    [HttpGet("title")]
    public async Task<ActionResult<EquippedTitleDto?>> GetEquippedTitle(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var title = await economyService.GetEquippedTitleAsync(userId, cancellationToken);
        // 原本 Ok(null) 可能由 MVC 轉為 204；使用 JsonResult 固定回傳契約要求的 200 與 JSON null。
        return new JsonResult(title is null ? null : ToTitleDto(title));
    }

    /// <summary>設定或清除目前會員配戴的成就稱號。</summary>
    [HttpPut("title")]
    public async Task<ActionResult<EquippedTitleDto?>> SetEquippedTitle(
        SetEquippedTitleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var result = await economyService.SetEquippedTitleAsync(
            userId,
            request.UserAchievementId,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);
        // 清除稱號仍回傳 JSON null，讓前台能沿用與查詢相同的回應解析方式。
        return new JsonResult(result.Value is null ? null : ToTitleDto(result.Value));
    }

    private static KeyBalanceDto ToKeyBalanceDto(KeyBalanceView value) => new(
        value.Id,
        value.Code,
        value.Name,
        value.ScopeType,
        value.CategoryId,
        value.EraBucketId,
        value.Balance,
        value.EligibleArtifactCount,
        value.RecyclePointValue);

    private static KeyExchangeRuleDto ToExchangeRuleDto(KeyExchangeRuleView value) => new(
        value.Id,
        value.SourceKeyCode,
        value.SourceKeyName,
        value.SourceAmount,
        value.TargetKeyCode,
        value.TargetKeyName,
        value.TargetAmount,
        value.TargetEligibleArtifactCount,
        value.Description);

    private static RedeemedCouponDto ToCouponDto(CouponView value) => new(
        value.Id,
        value.CouponDefinitionId,
        value.Code,
        value.Name,
        value.AcquisitionType,
        value.PointCost,
        value.DiscountType,
        value.DiscountValue,
        value.MinimumAmount,
        value.Status,
        value.IssuedAt,
        value.ExpiresAt,
        value.UsedAt,
        value.RevokedAt);

    private static EquippedTitleDto ToTitleDto(EquippedTitleView value) => new(
        value.UserAchievementId,
        value.AchievementId,
        value.AchievementCode,
        value.AchievementName,
        value.Title,
        value.UpdatedAt);
}
