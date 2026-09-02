using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

/// <summary>建立私人房間邀請的請求資料。</summary>
public sealed class CreateGameRoomInvitationRequest
{
    /// <summary>要被邀請加入房間的會員識別碼。</summary>
    [Required]
    public Guid InviteeUserId { get; set; }

    /// <summary>顯示在邀請通知中的補充訊息。</summary>
    [StringLength(300)]
    public string? Message { get; set; }
}

/// <summary>接受或拒絕私人房間邀請的請求資料。</summary>
public sealed class RespondGameRoomInvitationRequest
{
    /// <summary>回應動作，只接受 ACCEPT 或 DECLINE。</summary>
    [Required, RegularExpression("ACCEPT|DECLINE")]
    public string Decision { get; set; } = string.Empty;

    /// <summary>接受邀請後在房間內使用的顯示名稱；省略時沿用會員暱稱。</summary>
    [StringLength(80, MinimumLength = 1)]
    public string? DisplayName { get; set; }
}

/// <summary>私人房間邀請及實際結算的加碼結果。</summary>
public sealed record GameRoomInvitationDto(
    Guid Id,
    Guid RoomId,
    string RoomCode,
    string Status,
    Guid InviterUserId,
    string InviterDisplayName,
    Guid InviteeUserId,
    string InviteeDisplayName,
    string? Message,
    Guid? RewardCampaignId,
    int RewardPointAmount,
    Guid? RewardKeyDefinitionId,
    string? RewardKeyCode,
    string? RewardKeyName,
    int RewardKeyAmount,
    DateTime? RewardGrantedAt,
    DateTime CreatedAt,
    DateTime? RespondedAt);

/// <summary>建立或更新活動、私人房間加碼規則的請求資料。</summary>
public sealed class ConfigureCommunityRewardRequest
{
    /// <summary>每位實際符合條件的參與者取得的鑑定點數。</summary>
    [Range(0, 10000)]
    public int PointPerRecipient { get; set; }

    /// <summary>加碼使用的鑰匙定義；沒有鑰匙加碼時省略。</summary>
    public Guid? KeyDefinitionId { get; set; }

    /// <summary>每位實際符合條件的參與者取得的鑰匙數量。</summary>
    [Range(0, 100)]
    public int KeyPerRecipient { get; set; }

    /// <summary>會員活動的點數總上限；官方活動不使用此欄位。</summary>
    [Range(0, 1000000)]
    public int PointBudget { get; set; }

    /// <summary>會員活動的鑰匙總上限；官方活動不使用此欄位。</summary>
    [Range(0, 10000)]
    public int KeyBudget { get; set; }

    /// <summary>加碼開始時間；省略時使用目前 UTC 時間。</summary>
    public DateTime? ValidFrom { get; set; }

    /// <summary>加碼結束時間；省略時使用開始時間後七天。</summary>
    public DateTime? ValidUntil { get; set; }
}

/// <summary>活動或私人房間目前的加碼規則、有效期間與剩餘額度。</summary>
public sealed record CommunityRewardPolicyDto(
    Guid Id,
    string TargetType,
    Guid? EventId,
    Guid? GameRoomId,
    string SponsorType,
    string BudgetMode,
    int PointPerRecipient,
    Guid? KeyDefinitionId,
    string? KeyCode,
    string? KeyName,
    int KeyPerRecipient,
    int PointBudget,
    int? RemainingPointBudget,
    int PointIssued,
    int KeyBudget,
    int? RemainingKeyBudget,
    int KeyIssued,
    DateTime ValidFrom,
    DateTime ValidUntil,
    bool IsActive,
    DateTime UpdatedAt);
