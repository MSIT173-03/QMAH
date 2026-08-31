using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Models;

public sealed class OperationsFilterViewModel
{
    [DataType(DataType.Date)]
    public DateTime? From { get; set; }

    [DataType(DataType.Date)]
    public DateTime? To { get; set; }

    public int? Days { get; set; }
}

public sealed class OperationsDashboardViewModel
{
    public DateTime From { get; init; }

    public DateTime To { get; init; }

    public int PaidOrderCount { get; init; }

    public int CreatedOrderCount { get; init; }

    public int CancelledOrderCount { get; init; }

    public decimal PaidRevenue { get; init; }

    public decimal AverageOrderAmount { get; init; }

    public int GamePlayerJoinCount { get; init; }

    public int UniqueGameUserCount { get; init; }

    public int NewMemberCount { get; init; }

    public int MemberCountAtEnd { get; init; }

    public int GameRoomCount { get; init; }

    public int GameRoundCount { get; init; }

    public int GameAnswerCount { get; init; }

    public int SocialPostCount { get; init; }

    public int SocialCommentCount { get; init; }

    public int EventCount { get; init; }

    public int EventRegistrationCount { get; init; }

    public int MediaAssetCount { get; init; }

    public IReadOnlyList<OperationsRevenueDay> RevenueTrend { get; init; } = [];

    public IReadOnlyList<OperationsActivityDay> ActivityTrend { get; init; } = [];

    public IReadOnlyList<OperationsMonthSummary> MonthlyTrend { get; init; } = [];

    public IReadOnlyList<OperationsChartViewModel> Charts { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> OrderStatusBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> GameRoomStatusBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> AnswerTypeBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> SocialPostBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> SocialPublisherBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> EventTypeBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> EventReviewBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> EventPublishBreakdown { get; init; } = [];

    public IReadOnlyList<OperationsBreakdown> MediaBreakdown { get; init; } = [];
}

public sealed record OperationsRevenueDay(
    DateTime Date,
    int OrderCount,
    decimal Revenue,
    int NewMemberCount);

public sealed record OperationsActivityDay(
    DateTime Date,
    int PlayerJoinCount,
    int RoomCount,
    int RoundCount,
    int AnswerCount,
    int PostCount,
    int CommentCount,
    int EventCount,
    int EventRegistrationCount,
    int MediaAssetCount);

public sealed record OperationsMonthSummary(
    DateTime Month,
    int NewMemberCount,
    int PaidOrderCount,
    decimal Revenue,
    int GameJoinCount,
    int UniqueGameUserCount,
    int PostCount,
    int CommentCount,
    int EventCount,
    int EventRegistrationCount,
    int MediaAssetCount);

public sealed record OperationsBreakdown(
    string Label,
    int Count);

public sealed class OperationsChartViewModel
{
    public string Id { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public IReadOnlyList<string> Labels { get; init; } = [];

    public IReadOnlyList<OperationsChartSeries> Series { get; init; } = [];
}

public sealed record OperationsChartSeries(
    string Label,
    string ValueFormat,
    IReadOnlyList<decimal> Values);

public sealed class OperationsMetricDetailsViewModel
{
    public DateTime From { get; init; }

    public DateTime To { get; init; }

    public string MetricCode { get; init; } = string.Empty;

    public string MetricLabel { get; init; } = string.Empty;

    public string MetricDescription { get; init; } = string.Empty;

    public string GranularityLabel { get; init; } = "每日";

    public IReadOnlyList<OperationsMetricSeries> Series { get; init; } = [];

    public IReadOnlyList<OperationsMetricPoint> Points { get; init; } = [];

    public IReadOnlyList<OperationsMetricSummary> Summaries { get; init; } = [];

    public OperationsChartViewModel Chart { get; init; } = new();
}

public sealed record OperationsMetricSeries(
    string Label,
    string ValueFormat);

public sealed record OperationsMetricPoint(
    DateTime Date,
    IReadOnlyList<decimal> Values);

public sealed record OperationsMetricSummary(
    string Label,
    string ValueFormat,
    decimal Value);

public sealed class AuditLogFilterViewModel
{
    public string? Keyword { get; set; }

    public string? AreaCode { get; set; }

    [DataType(DataType.Date)]
    public DateTime? From { get; set; }

    [DataType(DataType.Date)]
    public DateTime? To { get; set; }

    [Range(100, 599)]
    public int? StatusCode { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(10, 100)]
    public int PageSize { get; set; } = 30;

    public int TotalCount { get; set; }

    public int TotalPages { get; set; }

    public IReadOnlyList<AuditLogListItemViewModel> Items { get; set; } = [];
}

public sealed class AuditLogListItemViewModel
{
    public long Id { get; init; }

    public Guid? ActorUserId { get; init; }

    public string ActorName { get; set; } = "系統或未知帳號";

    public string Area { get; init; } = string.Empty;

    public string Controller { get; init; } = string.Empty;

    public string Action { get; init; } = string.Empty;

    public string HttpMethod { get; init; } = string.Empty;

    public int ResultStatusCode { get; init; }

    public string? Detail { get; init; }

    public DateTime OccurredAt { get; init; }
}

public sealed class MediaAdminFilterViewModel
{
    public string? Keyword { get; set; }

    public string? Status { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(10, 100)]
    public int PageSize { get; set; } = 30;

    public int TotalCount { get; set; }

    public int TotalPages { get; set; }

    public IReadOnlyList<MediaAdminItemViewModel> Items { get; set; } = [];

    public IReadOnlyList<AvatarAdminItemViewModel> AvatarItems { get; set; } = [];
}

public sealed class MediaAdminItemViewModel
{
    public Guid Id { get; init; }

    public long SequenceNo { get; init; }

    public string OriginalFileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = string.Empty;

    public long FileSize { get; init; }

    public string? AltText { get; init; }

    public string Status { get; init; } = string.Empty;

    public string OwnerName { get; init; } = "未設定暱稱";

    public Guid? PostId { get; init; }

    public string? PostTitle { get; init; }

    public string? PostAuthorName { get; init; }

    public string? AvatarOwnerName { get; init; }

    public DateTime CreatedAt { get; init; }
}

public sealed class AvatarAdminItemViewModel
{
    public Guid UserId { get; init; }

    public string OwnerName { get; init; } = string.Empty;

    public string AvatarPath { get; init; } = string.Empty;
}
