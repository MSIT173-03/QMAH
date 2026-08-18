namespace QMAH.Web.Areas.Store.ViewModels;

public sealed class StoreDashboardViewModel
{
    public int ProductCount { get; init; }

    public int ActiveProductCount { get; init; }

    public int LowStockProductCount { get; init; }

    public int OrderCount { get; init; }

    public int PendingOrderCount { get; init; }

    public int CouponCount { get; init; }

    public int SuccessfulPaymentCount { get; init; }

    public IReadOnlyList<StoreDashboardOrderItem> RecentOrders { get; init; } = [];
}

public sealed class StoreDashboardOrderItem
{
    public Guid Id { get; init; }

    public string OrderNo { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public decimal TotalAmount { get; init; }

    public DateTime CreatedAt { get; init; }

    public string CustomerName { get; init; } = string.Empty;
}
