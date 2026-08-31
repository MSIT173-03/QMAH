using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

public sealed record ArtifactListItemDto(
    Guid Id,
    string ArtifactRef,
    string Name,
    string CategoryCode,
    string CategoryName,
    string EraCode,
    string EraName,
    string? ThumbnailPath,
    bool HasQuestionEntry,
    bool HasShopProduct);

public sealed record ArtifactDetailsDto(
    Guid Id,
    string ArtifactRef,
    string Name,
    string CategoryCode,
    string CategoryName,
    string EraCode,
    string EraName,
    string? EraTextOriginal,
    string? CreatorDisplay,
    string? Description,
    string? SizeText,
    string PrimaryImagePath,
    string? ThumbnailPath,
    string SourceUrl,
    string? LicenseCode,
    string? AttributionText,
    bool HasQuestionEntry,
    bool HasShopProduct);

public sealed record CodeLabelDto(Guid Id, string Code, string Name);

public sealed record ProductListItemDto(
    Guid Id,
    Guid? ArtifactId,
    string? ExternalRef,
    string Name,
    string CategoryCode,
    decimal Price,
    int Stock,
    string? PrimaryImagePath,
    bool IsActive);

public sealed record ProductDetailsDto(
    Guid Id,
    Guid? ArtifactId,
    string? ArtifactRef,
    string? ArtifactName,
    string? ExternalRef,
    string Name,
    string CategoryCode,
    string? Description,
    string? SizeText,
    decimal Price,
    int Stock,
    string? PrimaryImagePath,
    string? SourceUrl,
    bool IsActive,
    decimal AverageRating,
    int ReviewCount);

public sealed record ProductReviewSummaryDto(
    decimal AverageRating,
    int ReviewCount);

public sealed record ProductReviewDto(
    Guid Id,
    Guid ProductId,
    Guid UserId,
    string? DisplayName,
    byte Rating,
    string Content,
    bool IsVerifiedPurchase,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ProductReviewsResponseDto(
    ProductReviewSummaryDto Summary,
    ApiPage<ProductReviewDto> Reviews);

public sealed class UpsertProductReviewRequest
{
    [Range(1, 5)]
    public byte Rating { get; set; }

    [Required, StringLength(1000, MinimumLength = 1)]
    public string Content { get; set; } = "";
}

public sealed record SocialPostListItemDto(
    Guid Id,
    string BoardCode,
    Guid UserId,
    string? DisplayName,
    Guid? ArtifactId,
    Guid? EventId,
    string PostType,
    string PublisherType,
    string Title,
    string ContentPreview,
    int CommentCount,
    int MediaCount,
    string? LocationName,
    decimal? Latitude,
    decimal? Longitude,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SocialMediaDto(
    Guid Id,
    string Url,
    string? AltText,
    string ContentType,
    long FileSize,
    DateTime CreatedAt);

public sealed record SocialCommentDto(
    Guid Id,
    Guid PostId,
    Guid? ParentCommentId,
    Guid UserId,
    string? DisplayName,
    string Content,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SocialPostDetailsDto(
    Guid Id,
    string BoardCode,
    Guid UserId,
    string? DisplayName,
    Guid? ArtifactId,
    Guid? EventId,
    string PostType,
    string PublisherType,
    string Title,
    string Content,
    IReadOnlyList<SocialCommentDto> Comments,
    IReadOnlyList<SocialMediaDto> Media,
    string? LocationName,
    decimal? Latitude,
    decimal? Longitude,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record EventListItemDto(
    Guid Id,
    Guid? SocialPostId,
    string EventType,
    Guid? OrganizerUserId,
    string Title,
    string Content,
    string? Location,
    decimal? Latitude,
    decimal? Longitude,
    DateTime StartAt,
    DateTime EndAt,
    DateTime? RegistrationEndAt,
    int? Capacity,
    int RegistrationCount);

public sealed record SocialEventDetailsDto(
    Guid Id,
    Guid? SocialPostId,
    string EventType,
    Guid? OrganizerUserId,
    string Title,
    string Content,
    string? Location,
    decimal? Latitude,
    decimal? Longitude,
    DateTime StartAt,
    DateTime EndAt,
    DateTime? RegistrationEndAt,
    int? Capacity,
    int RegistrationCount,
    bool IsRegistered,
    string? ReviewStatus = null,
    string? PublishStatus = null);

public sealed record AnnouncementDto(
    Guid Id,
    string Title,
    string? Summary,
    string Content,
    string Category,
    DateTime? PublishAt,
    DateTime? EndAt,
    Guid UserId,
    string? DisplayName,
    string PostType,
    string PublisherType,
    Guid? EventId,
    DateTime CreatedAt);

public sealed record GameRoomListItemDto(
    Guid Id,
    string RoomCode,
    string Status,
    string Visibility,
    byte MaxPlayers,
    byte TotalRounds,
    int PlayerCount,
    DateTime CreatedAt);

public sealed record GamePlayerDto(
    Guid Id,
    string DisplayName,
    string Role,
    bool IsReady,
    byte? SeatNo,
    string ConnectionStatus);

public sealed record GameRoomDetailsDto(
    Guid Id,
    string RoomCode,
    string Status,
    string Visibility,
    byte MaxPlayers,
    byte TotalRounds,
    short AnswerSeconds,
    short VotingSeconds,
    string? CategoryFilterCode,
    string? EraBucketFilterCode,
    byte CurrentRoundNo,
    IReadOnlyList<GamePlayerDto> Players,
    DateTime CreatedAt,
    DateTime? StartedAt,
    DateTime? EndedAt);

public sealed record GameAnswerDto(
    Guid Id,
    Guid GamePlayerId,
    string PlayerDisplayName,
    string AnswerType,
    string Text,
    int VoteCount,
    int Rank,
    bool IsWinner,
    DateTime SubmittedAt);

public sealed record GameRoundDetailsDto(
    Guid Id,
    Guid RoomId,
    Guid ArtifactId,
    string ArtifactName,
    int RoundNumber,
    string Status,
    bool IsSettled,
    DateTime StartedAt,
    DateTime AnswerDeadlineAt,
    DateTime VotingDeadlineAt,
    DateTime? SettledAt,
    int ParticipantCount,
    int TotalVoteCount,
    Guid? WinnerAnswerId,
    string? WinnerPlayerDisplayName,
    IReadOnlyList<GameAnswerDto> Answers);

public sealed record GameRoundSummaryDto(
    Guid Id,
    int RoundNumber,
    Guid ArtifactId,
    string ArtifactName,
    string Status,
    bool IsSettled,
    DateTime StartedAt,
    DateTime? SettledAt,
    int AnswerCount,
    int TotalVoteCount,
    Guid? WinnerAnswerId,
    string? WinnerPlayerDisplayName,
    IReadOnlyList<GameAnswerDto> Answers);

public sealed record GameLeaderboardItemDto(
    Guid GamePlayerId,
    string DisplayName,
    int Score,
    int RoundsAnswered,
    int RoundsWon,
    int Rank);

public sealed record GameRoomHistoryDto(
    Guid RoomId,
    string RoomCode,
    string Status,
    IReadOnlyList<GameRoundSummaryDto> Rounds,
    IReadOnlyList<GameLeaderboardItemDto> Leaderboard);

public sealed class CreateGameRoomRequest
{
    [Required, StringLength(20)]
    public string Visibility { get; set; } = "PUBLIC";

    [StringLength(128)]
    public string? Password { get; set; }

    [Required, StringLength(80, MinimumLength = 1)]
    public string DisplayName { get; set; } = "玩家";

    [Range(3, 10)]
    public byte MaxPlayers { get; set; } = 6;

    [Range(1, 5)]
    public byte TotalRounds { get; set; } = 3;

    [Range(30, 300)]
    public short AnswerSeconds { get; set; } = 120;

    [Range(20, 180)]
    public short VotingSeconds { get; set; } = 60;

    [StringLength(32)]
    public string? CategoryFilterCode { get; set; }

    [StringLength(32)]
    public string? EraBucketFilterCode { get; set; }
}

public sealed class JoinGameRoomRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public string DisplayName { get; set; } = "玩家";

    [StringLength(128)]
    public string? Password { get; set; }
}

public sealed class SubmitAnswerRequest
{
    [Required, StringLength(32)]
    public string AnswerType { get; set; } = "";

    [Required, StringLength(500, MinimumLength = 1)]
    public string Text { get; set; } = "";
}

public sealed class SubmitVoteRequest
{
    [Required]
    public Guid AnswerId { get; set; }

    [Range(1, 5)]
    public int Count { get; set; } = 1;
}

public sealed class CreateSocialPostRequest
{
    [RegularExpression("POST|ANNOUNCEMENT")]
    public string PostType { get; set; } = "POST";

    [Required, StringLength(32)]
    public string BoardCode { get; set; } = "GENERAL";

    [StringLength(80, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    public Guid? ArtifactId { get; set; }

    [StringLength(200)]
    public string? LocationName { get; set; }

    [Range(typeof(decimal), "-90", "90")]
    public decimal? Latitude { get; set; }

    [Range(typeof(decimal), "-180", "180")]
    public decimal? Longitude { get; set; }

    [MaxLength(8)]
    public List<Guid> MediaIds { get; set; } = [];
}

public sealed class CreateSocialEventRequest
{
    [Required, StringLength(20)]
    public string EventType { get; set; } = "PLAYER";

    [Required, StringLength(150, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    [StringLength(200)]
    public string? Location { get; set; }

    [Range(typeof(decimal), "-90", "90")]
    public decimal? Latitude { get; set; }

    [Range(typeof(decimal), "-180", "180")]
    public decimal? Longitude { get; set; }

    [Required]
    public DateTime StartAt { get; set; }

    [Required]
    public DateTime EndAt { get; set; }

    public DateTime? RegistrationEndAt { get; set; }

    [Range(1, int.MaxValue)]
    public int? Capacity { get; set; }

    [RegularExpression("TEMPLATE|CUSTOM")]
    public string PostContentMode { get; set; } = "TEMPLATE";

    [StringLength(150)]
    public string? PostTitle { get; set; }

    [StringLength(4000)]
    public string? PostContent { get; set; }
}

public sealed class CreateSocialCommentRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    public Guid? ParentCommentId { get; set; }
}

public sealed class CreateContentReportRequest
{
    [Required, StringLength(20)]
    public string TargetType { get; set; } = "";

    [Required]
    public Guid TargetId { get; set; }

    [Required, StringLength(80)]
    public string Reason { get; set; } = "";

    [StringLength(1000)]
    public string? Detail { get; set; }
}

public sealed record UserAddressDto(
    Guid Id,
    string AddressLabel,
    string RecipientName,
    string RecipientPhone,
    string? PostalCode,
    string? City,
    string? District,
    string AddressLine,
    decimal? Latitude,
    decimal? Longitude,
    bool IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed class UpsertUserAddressRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string AddressLabel { get; set; } = "";

    [Required, StringLength(80, MinimumLength = 1)]
    public string RecipientName { get; set; } = "";

    [Required, StringLength(30, MinimumLength = 1)]
    public string RecipientPhone { get; set; } = "";

    [StringLength(20)]
    public string? PostalCode { get; set; }

    [StringLength(80)]
    public string? City { get; set; }

    [StringLength(80)]
    public string? District { get; set; }

    [Required, StringLength(300, MinimumLength = 1)]
    public string AddressLine { get; set; } = "";

    [Range(typeof(decimal), "-90", "90")]
    public decimal? Latitude { get; set; }

    [Range(typeof(decimal), "-180", "180")]
    public decimal? Longitude { get; set; }

    public bool IsDefault { get; set; }
}

public sealed record CouponDto(
    Guid Id,
    string Code,
    string Name,
    string DiscountType,
    decimal DiscountValue,
    decimal MinimumAmount,
    DateTime StartAt,
    DateTime EndAt,
    string Status,
    DateTime IssuedAt);

public sealed class CreateOrderItemRequest
{
    [Required]
    public Guid ProductId { get; set; }

    [Range(1, 99)]
    public int Quantity { get; set; }
}

public sealed class CreateStoreOrderRequest
{
    [Required, MinLength(1)]
    public List<CreateOrderItemRequest> Items { get; set; } = [];

    public Guid? UserCouponId { get; set; }

    [Range(0, int.MaxValue)]
    public int PointsUsed { get; set; }

    [Required, StringLength(100, MinimumLength = 1)]
    public string RecipientName { get; set; } = "";

    [Required, StringLength(30, MinimumLength = 1)]
    public string RecipientPhone { get; set; } = "";

    [Required, StringLength(10, MinimumLength = 1)]
    public string ShippingPostalCode { get; set; } = "";

    [Required, StringLength(50, MinimumLength = 1)]
    public string ShippingCity { get; set; } = "";

    [Required, StringLength(50, MinimumLength = 1)]
    public string ShippingDistrict { get; set; } = "";

    [Required, StringLength(200, MinimumLength = 1)]
    public string ShippingAddressLine { get; set; } = "";
}

public sealed record OrderLineDto(
    Guid ProductId,
    string ProductName,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);

public sealed record OrderDto(
    Guid Id,
    string OrderNo,
    string Status,
    decimal Subtotal,
    decimal DiscountAmount,
    int PointsUsed,
    decimal TotalAmount,
    string RecipientName,
    string RecipientPhone,
    string ShippingPostalCode,
    string ShippingCity,
    string ShippingDistrict,
    string ShippingAddressLine,
    string? PaymentStatus,
    DateTime CreatedAt,
    DateTime? PaidAt,
    DateTime? CancelledAt,
    IReadOnlyList<OrderLineDto> Items);

public sealed record MeDto(
    Guid Id,
    string Email,
    string? DisplayName,
    string Status,
    int PointBalance,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    string? Bio,
    string Visibility,
    string? AvatarPath);

public sealed class UpdateProfileRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public string Nickname { get; set; } = "";

    [StringLength(1000)]
    public string? Bio { get; set; }

    [Required, RegularExpression("PUBLIC|FRIENDS|PRIVATE")]
    public string Visibility { get; set; } = "PRIVATE";
}

public sealed record UserAchievementDto(
    Guid Id,
    Guid AchievementId,
    string Code,
    string Name,
    string Title,
    string? Description,
    string? IconPath,
    string ConditionType,
    long ThresholdValue,
    DateTime AchievedAt,
    bool IsDisplayed,
    DateTime? DisplayedAt);

public sealed record CartItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string? PrimaryImagePath,
    decimal UnitPrice,
    int Quantity,
    int AvailableStock,
    decimal LineTotal,
    DateTime AddedAt);

public sealed class UpsertCartItemRequest
{
    [Required]
    public Guid ProductId { get; set; }

    [Range(1, 99)]
    public int Quantity { get; set; }
}

public sealed record NotificationDto(
    Guid Id,
    string Title,
    string Content,
    string? TargetUrl,
    bool IsRead,
    DateTime CreatedAt,
    DateTime? ReadAt);

public sealed class ForgotPasswordRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = "";
}

public sealed class LoginRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = "";

    [Required, StringLength(100)]
    public string Password { get; set; } = "";

    public bool RememberMe { get; set; }
}

public sealed class RegisterRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = "";

    [Required, StringLength(80, MinimumLength = 1)]
    public string Nickname { get; set; } = "";

    [Required, StringLength(100, MinimumLength = 8), DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [Required, Compare(nameof(Password)), DataType(DataType.Password)]
    public string ConfirmPassword { get; set; } = "";
}

public sealed class ResetPasswordRequest
{
    [Required, EmailAddress, StringLength(256)]
    public string Email { get; set; } = "";

    [Required]
    public string Token { get; set; } = "";

    [Required, StringLength(100, MinimumLength = 8), DataType(DataType.Password)]
    public string NewPassword { get; set; } = "";

    [Required, Compare(nameof(NewPassword)), DataType(DataType.Password)]
    public string ConfirmPassword { get; set; } = "";
}

public sealed record DashboardTrendDto(DateTime Date, int Orders, decimal Revenue);

public sealed record DashboardStatusDto(string Status, int Count);

public sealed record DashboardProductDto(Guid ProductId, string Name, int Quantity, decimal Revenue);

public sealed record DashboardDto(
    int MemberCount,
    int ActiveMemberCount,
    int ArtifactCount,
    int QuestionEntryCount,
    int SocialPostCount,
    int CommentCount,
    int EventCount,
    int GameRoomCount,
    int ProductCount,
    int PendingReportCount,
    int CouponCount,
    int PointTransactionCount,
    int OrderCount,
    decimal PaidRevenue,
    IReadOnlyList<DashboardTrendDto> OrderTrend,
    IReadOnlyList<DashboardStatusDto> OrderStatuses,
    IReadOnlyList<DashboardProductDto> HotProducts);

public sealed record MetadataOptionDto(string Code, string Label);

public sealed record ApiMetadataDto(
    IReadOnlyList<CodeLabelDto> Categories,
    IReadOnlyList<CodeLabelDto> Eras,
    IReadOnlyList<MetadataOptionDto> SocialBoards,
    IReadOnlyList<MetadataOptionDto> SocialPostTypes,
    IReadOnlyList<MetadataOptionDto> SocialPublisherTypes,
    IReadOnlyList<MetadataOptionDto> EventTypes,
    IReadOnlyList<MetadataOptionDto> EventReviewStatuses,
    IReadOnlyList<MetadataOptionDto> EventPublishStatuses,
    IReadOnlyList<MetadataOptionDto> MediaStatuses);
