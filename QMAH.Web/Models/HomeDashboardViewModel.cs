namespace QMAH.Web.Models;

public sealed class HomeDashboardViewModel
{
    public int ArtifactCount { get; init; }

    public int ActiveArtifactCount { get; init; }

    public int PublishedPostCount { get; init; }

    public int ActiveEventCount { get; init; }

    public int MemberCount { get; init; }

    public int ActiveMemberCount { get; init; }

    public int ProductCount { get; init; }

    public int ActiveProductCount { get; init; }

    public int TodayOrderCount { get; init; }

    public int MonthOrderCount { get; init; }

    public decimal TodayPaidRevenue { get; init; }

    public decimal MonthPaidRevenue { get; init; }

    public decimal AveragePaidOrderAmount { get; init; }

    public int UsedCouponCount { get; init; }

    public int PointTransactionCount { get; init; }

    public IReadOnlyList<HomeDashboardTrendItem> RecentOrderTrend { get; init; } = [];

    public IReadOnlyList<HomeDashboardStatusItem> OrderStatuses { get; init; } = [];

    public IReadOnlyList<HomeDashboardProductItem> HotProducts { get; init; } = [];

    public bool IsAuthenticated { get; init; }

    public bool IsAdmin { get; init; }

    public string MemberDisplayName { get; init; } = "會員";
}

public sealed record HomeDashboardTrendItem(DateTime Date, int Orders, decimal Revenue);

public sealed record HomeDashboardStatusItem(string Status, int Count);

public sealed record HomeDashboardProductItem(Guid ProductId, string Name, int Quantity, decimal Revenue);
