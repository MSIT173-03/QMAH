using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

/// <summary>目前會員的鑑定點數、鑰匙進度、鑰匙餘額與可用兌換規則。</summary>
public sealed record MemberEconomyDto(
    int PointBalance,
    int KeyProgressBalance,
    int KeyProgressToNormalKey,
    IReadOnlyList<KeyBalanceDto> Keys,
    IReadOnlyList<KeyExchangeRuleDto> ExchangeRules);

/// <summary>單一鑰匙在目前會員帳號中的餘額與可解鎖文物數量。</summary>
public sealed record KeyBalanceDto(
    Guid Id,
    string Code,
    string Name,
    string ScopeType,
    Guid? CategoryId,
    Guid? EraBucketId,
    int Balance,
    int EligibleArtifactCount,
    int RecyclePointValue);

/// <summary>一條可供目前會員使用的鑰匙兌換規則。</summary>
public sealed record KeyExchangeRuleDto(
    Guid Id,
    string SourceKeyCode,
    string SourceKeyName,
    int SourceAmount,
    string TargetKeyCode,
    string TargetKeyName,
    int TargetAmount,
    int TargetEligibleArtifactCount,
    string? Description);

/// <summary>使用鑰匙解鎖文物時的選填指定文物資料。</summary>
public sealed class UnlockArtifactRequest
{
    public Guid? ArtifactId { get; set; }
}

/// <summary>執行鑰匙兌換時使用的規則識別碼與兌換組數。</summary>
public sealed class ExchangeKeyRequest
{
    [Required]
    public Guid RuleId { get; set; }

    [Range(1, 100)]
    public int Units { get; set; } = 1;
}

/// <summary>回收指定數量鑰匙的請求。</summary>
public sealed class RecycleKeyRequest
{
    [Range(1, 100)]
    public int Amount { get; set; } = 1;
}

/// <summary>使用鑰匙後的解鎖結果；沒有候選文物時不會扣除鑰匙。</summary>
public sealed record ArtifactUnlockResultDto(
    bool Unlocked,
    Guid? ArtifactId,
    string? ArtifactName,
    int RemainingEligibleArtifactCount,
    string? Message);

/// <summary>鑰匙兌換完成後的來源、目標與剩餘候選數量。</summary>
public sealed record KeyExchangeResultDto(
    Guid RuleId,
    string SourceKeyCode,
    int SourceAmount,
    string TargetKeyCode,
    int TargetAmount,
    int TargetEligibleArtifactCount);

/// <summary>鑰匙回收完成後的鑰匙、點數與剩餘候選數量。</summary>
public sealed record KeyRecycleResultDto(
    string KeyCode,
    int KeyAmount,
    int PointAmount,
    int RemainingEligibleArtifactCount);

/// <summary>目前可用的鑑定點數兌換優惠券設定。</summary>
public sealed record PointCouponOptionDto(
    Guid Id,
    string Code,
    string Name,
    int PointCost,
    string DiscountType,
    decimal DiscountValue,
    decimal MinimumAmount,
    int ValidityDays,
    DateTime StartAt,
    DateTime EndAt);

/// <summary>以鑑定點數兌換一張優惠券的請求。</summary>
public sealed class RedeemCouponRequest
{
    [Required]
    public Guid CouponDefinitionId { get; set; }
}

/// <summary>會員取得優惠券後的折扣條件、期限與生命週期狀態。</summary>
public sealed record RedeemedCouponDto(
    Guid Id,
    Guid CouponDefinitionId,
    string Code,
    string Name,
    string AcquisitionType,
    int? PointCost,
    string DiscountType,
    decimal DiscountValue,
    decimal MinimumAmount,
    string Status,
    DateTime IssuedAt,
    DateTime ExpiresAt,
    DateTime? UsedAt,
    DateTime? RevokedAt);

/// <summary>會員目前配戴的單一成就稱號。</summary>
public sealed record EquippedTitleDto(
    Guid UserAchievementId,
    Guid AchievementId,
    string AchievementCode,
    string AchievementName,
    string Title,
    DateTime UpdatedAt);

/// <summary>設定或清除目前配戴稱號的請求；UserAchievementId 為 null 代表清除。</summary>
public sealed class SetEquippedTitleRequest
{
    public Guid? UserAchievementId { get; set; }
}
