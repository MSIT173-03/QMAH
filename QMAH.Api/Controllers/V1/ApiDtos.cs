using System.ComponentModel.DataAnnotations;

using QMAH.Api.Infrastructure.Payments;

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

/// <summary>目前會員圖鑑清單中的文物，以及該會員的解鎖狀態。</summary>
public sealed record MemberArtifactListItemDto(
    Guid Id,
    string ArtifactRef,
    string Name,
    Guid CategoryId,
    string CategoryCode,
    string CategoryName,
    Guid EraBucketId,
    string EraCode,
    string EraName,
    string? ThumbnailPath,
    bool HasQuestionEntry,
    bool HasShopProduct,
    bool IsUnlocked,
    DateTime? UnlockedAt);

/// <summary>目前會員的一筆文物解鎖歷史。</summary>
public sealed record MemberArtifactUnlockDto(
    Guid Id,
    Guid ArtifactId,
    string ArtifactRef,
    string ArtifactName,
    string CategoryCode,
    string CategoryName,
    string EraCode,
    string EraName,
    string UnlockMethod,
    Guid? GameRoundId,
    Guid? KeyTransactionId,
    string? KeyCode,
    string? KeyName,
    DateTime UnlockedAt);

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

public sealed record AccountSessionDto(Guid UserId, string Email, string? Nickname);

// integration: 前端只需要知道選用登入能力是否啟用，不應取得 ClientSecret 或猜測部署設定。
// 回傳 capability（能力旗標）可讓缺少第三方 OAuth secret 時停用單一按鈕，保留一般 Identity 登入。
public sealed record AccountCapabilitiesDto(bool GoogleLoginEnabled);

// Store 商品 DTO 暴露定價、後端計算的折扣率與有效售價；DiscountRate 是大量套用折扣的來源，
// SalePrice 是指定單品價或依 DiscountRate 計算出的唯讀顯示欄位，EffectivePrice 遵守相同優先規則。
public sealed record ProductListItemDto(
    Guid Id,
    Guid? ArtifactId,
    string? ExternalRef,
    string Name,
    string CategoryCode,
    decimal Price,
    decimal DiscountRate,
    decimal EffectivePrice,
    decimal? SalePrice,
    int Stock,
    string? PrimaryImagePath,
    DateTime CreatedAt,
    decimal AverageRating,
    int ReviewCount,
    int SellCount);

/// <summary>商城分類入口資料；商品件數由目前啟用中的商品即時計算。</summary>
public sealed record StoreCategoryDto(
    Guid Id,
    string Code,
    string Name,
    int ProductCount);

/// <summary>商城年代入口資料；年代取自商品對應的文物，件數由目前啟用中的商品即時計算。</summary>
public sealed record StoreEraDto(
    Guid Id,
    string Code,
    string Name,
    int ProductCount);

// integration: 商城活動直接引用已發布的官方商城公告；不複製優惠券文案，也不讓前台解析自由文字。
public sealed record StorePromotionDto(
    Guid Id,
    string Title,
    string Content,
    DateTime PublishedAt);

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
    // 商品固定是 A6 明信片；原文物尺寸另回傳，避免前台只能顯示其中一種尺寸。
    string? ArtifactSizeText,
    decimal Price,
    decimal DiscountRate,
    decimal EffectivePrice,
    decimal? SalePrice,
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

/// <summary>
/// 折價券商店可兌換的折價券定義（store.CouponDefinitions 中仍在活動期間、可用點數兌換的項目）。
/// DiscountType 為 PERCENT 時，DiscountValue 是折抵百分比（10 代表折 10%）；為 FIXED 時是折抵金額。
/// </summary>
public sealed record StoreCouponDto(
    Guid Id,
    string Name,
    string DiscountType,
    decimal DiscountValue,
    decimal MinimumAmount,
    int PointCost,
    int ValidityDays,
    DateTime EndAt);

/// <summary>會員在折價券商店以點數兌換一張折價券後的結果。</summary>
/// <param name="UserCouponId">新建立的會員折價券 ID（store.UserCoupons.Id）。</param>
/// <param name="PointCost">本次扣除的點數。</param>
/// <param name="RemainingPoints">扣除後的點數餘額。</param>
/// <param name="ExpiresAt">會員這張折價券的到期時間。</param>
public sealed record StoreCouponRedeemResultDto(
    Guid UserCouponId,
    string Name,
    int PointCost,
    int RemainingPoints,
    DateTime ExpiresAt);

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
    string? CoverImageUrl,
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
    DateTime UpdatedAt,
    string? ContentHtml = null,
    string MediaLayout = "SECONDARY");

public sealed record EventListItemDto(
    Guid Id,
    Guid? SocialPostId,
    string EventType,
    Guid? OrganizerUserId,
    string? OrganizerDisplayName,
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
    string? CoverImageUrl = null);

public sealed record SocialEventDetailsDto(
    Guid Id,
    Guid? SocialPostId,
    string EventType,
    Guid? OrganizerUserId,
    string? OrganizerDisplayName,
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
    IReadOnlyList<SocialMediaDto> Media,
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

public sealed class CreateSocialPostRequest
{
    // 公告改由 QMAH.Web 後台發布；前台 API 只接受一般貼文。
    [RegularExpression("POST", ErrorMessage = "前台只能發布一般貼文；站方公告請由後台發布。")]
    public string PostType { get; set; } = "POST";

    [Required, StringLength(32)]
    public string BoardCode { get; set; } = "GENERAL";

    [StringLength(80, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    /// <summary>圖片排版：SECONDARY 文字為主（預設）、PRIMARY 圖片為主。</summary>
    [RegularExpression("PRIMARY|SECONDARY", ErrorMessage = "圖片排版只能是 PRIMARY 或 SECONDARY。")]
    public string MediaLayout { get; set; } = "SECONDARY";

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

    [MaxLength(8)]
    public List<Guid> MediaIds { get; set; } = [];
}

public sealed class CreateSocialCommentRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    public Guid? ParentCommentId { get; set; }
}

public sealed class EnsureArtifactDiscussionRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string InitialComment { get; set; } = "";
}

/// <summary>文物討論串頂端的文物卡。玩家沒有解鎖該文物時，只回傳 Unlocked=false，其餘欄位全是 null（前台顯示問號）。</summary>
public sealed record SocialPostArtifactDto(
    Guid ArtifactId,
    bool Unlocked,
    bool HasUniversalKey,
    string? Name,
    string? ImageUrl,
    string? Description,
    string? CategoryName,
    string? EraName,
    string? EraText,
    string? Creator,
    string? SizeText);

public sealed record EnsureArtifactDiscussionResultDto(
    Guid PostId,
    bool Created,
    Guid CommentId);

public sealed class UpdateSocialPostRequest
{
    [StringLength(80, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [Required, StringLength(4000, MinimumLength = 1)]
    public string Content { get; set; } = "";

    /// <summary>圖片排版；null 代表不變。</summary>
    [RegularExpression("PRIMARY|SECONDARY", ErrorMessage = "圖片排版只能是 PRIMARY 或 SECONDARY。")]
    public string? MediaLayout { get; set; }

    /// <summary>
    /// 這篇貼文最後要保留的圖片（含新上傳、尚未綁定的）；null 代表圖片不變，沒列在內的既有圖片會被移除。
    /// 抽換圖片＝先上傳新圖，再用新圖識別碼取代舊圖識別碼（內文裡的 [img=舊] 也要一併換成 [img=新]）。
    /// </summary>
    public List<Guid>? MediaIds { get; set; }
}

public sealed class UpdateSocialCommentRequest
{
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Content { get; set; } = "";
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
    string AcquisitionType,
    int? PointCost,
    string DiscountType,
    decimal DiscountValue,
    decimal MinimumAmount,
    DateTime StartAt,
    DateTime EndAt,
    string Status,
    DateTime IssuedAt,
    DateTime ExpiresAt,
    DateTime? UsedAt);

// integration: 訂單 request／response 與 persistence entity 分離；訂單明細的商品名稱、單價快照
// 由 StoreOrdersController 建立，讓商品後續異動不會改寫歷史訂單。
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

    // integration: 這是同一次下單重送時使用的安全識別，不改變訂單功能；
    // 有提供時可在 commit 回應遺失後找回原訂單，避免重複扣庫存與會員資產。
    [StringLength(64, MinimumLength = 1)]
    public string? IdempotencyKey { get; set; }

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

    /// <summary>模擬的配送方式代碼，須存在於 StoreCheckoutCatalog.ShippingOptions。</summary>
    [Required, StringLength(40, MinimumLength = 1)]
    public string ShippingOptionId { get; set; } = "";

    /// <summary>模擬的付款方式代碼，須存在於 StoreCheckoutCatalog.PaymentOptions；直接存入 Payment.PaymentType。</summary>
    [Required, StringLength(40, MinimumLength = 1)]
    public string PaymentOptionId { get; set; } = "";
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
    decimal ShippingFee,
    decimal TotalAmount,
    // 依應付總額與 StoreCheckoutCatalog.PointEarnRate 換算；信用卡付款完成（綠界 callback）時才實際入帳。
    int PointsEarned,
    string RecipientName,
    string RecipientPhone,
    string ShippingPostalCode,
    string ShippingCity,
    string ShippingDistrict,
    string ShippingAddressLine,
    string? PaymentStatus,
    // COD（貨到付款）或 CREDIT_CARD（綠界信用卡）；前端依此決定是否顯示「前往付款」。
    string? PaymentType,
    DateTime CreatedAt,
    DateTime? PaidAt,
    DateTime? CancelledAt,
    IReadOnlyList<OrderLineDto> Items,
    // 只有建立訂單的回應才有值（待付款的信用卡訂單）；讀取訂單時一律為 null，
    // 重新付款改呼叫 POST /store/orders/{id}/ecpay-checkout 取得新表單。
    EcpayCheckoutFormDto? EcpayCheckout);

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

/// <summary>會員已取得的一筆成就與成就稱號資料。</summary>
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
    // 器類代碼；購物車頁依件數最多的器類挑選「再加購」商品。
    string CategoryCode,
    string? PrimaryImagePath,
    decimal UnitPrice,
    decimal? OriginalPrice,
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

    // Cloudflare Turnstile 驗證 Token 9/29
    [Required, StringLength(2048)]
    public string TurnstileToken { get; set; } = "";
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

/// <summary>其他會員可看到的公開個人頁資料；個人檔案非 PUBLIC 時只回傳暱稱與統計。</summary>
public sealed record SocialMemberProfileDto(
    Guid UserId,
    string Nickname,
    string? AvatarUrl,
    string? Bio,
    DateTime? JoinedAt,
    string? Email,
    bool IsPublic,
    int PostCount,
    int EventCount);

/// <summary>活動發起人看到的參加者名單；取消報名的人另外放在 Cancelled，只記「來過並取消」，不保留每次操作的流水紀錄。</summary>
public sealed record EventRegistrationsDto(
    IReadOnlyList<EventRegistrantDto> Active,
    IReadOnlyList<EventRegistrantDto> Cancelled);

public sealed record EventRegistrantDto(
    Guid UserId,
    string? DisplayName,
    string Status,
    DateTime RegisteredAt);
