namespace QMAH.Web.Areas.Store.ViewModels;

public sealed class CouponOwnerSummaryViewModel
{
    public Guid UserId { get; init; }
    public string MemberName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public int TotalCount { get; init; }
    public int AvailableCount { get; init; }
}

public sealed class CouponBackpackItemViewModel
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string MemberName { get; init; } = string.Empty;
    public string CouponName { get; init; } = string.Empty;
    public string CouponCode { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime IssuedAt { get; init; }
    public DateTime? UsedAt { get; init; }
}
