using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Data;

/// <summary>
/// 商城訂單的狀態通知：只要有任何地方（會員 API、綠界回呼、逾時取消、獨立後台）把訂單新增或改了狀態，
/// 就在同一次 SaveChanges 內為該會員加一筆站內通知，與訂單異動同成敗；
/// 通知再由 NotificationPushService 偵測並即時推播，所以不必在每個改狀態的地方各寫一次。
/// </summary>
public partial class QmahDbContext
{
    private const string OrdersUrl = "/store/orders";

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        QueueOrderNotifications();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        QueueOrderNotifications();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void QueueOrderNotifications()
    {
        var changed = ChangeTracker.Entries<StoreOrder>()
            .Where(entry => entry.State == EntityState.Added
                || (entry.State == EntityState.Modified && entry.Property(order => order.Status).IsModified
                    && entry.Property(order => order.Status).OriginalValue != entry.Entity.Status))
            .Select(entry => (entry.Entity, IsNew: entry.State == EntityState.Added))
            .ToList();

        foreach (var (order, isNew) in changed)
        {
            var message = OrderMessage(order, isNew);
            if (message is null)
                continue;
            UserNotifications.Add(new UserNotification
            {
                Id = Guid.NewGuid(),
                UserId = order.UserId,
                Title = message.Value.Title,
                Content = message.Value.Content,
                TargetUrl = OrdersUrl,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    private static (string Title, string Content)? OrderMessage(StoreOrder order, bool isNew) => order.Status switch
    {
        "PENDING_PAYMENT" when isNew => ("訂單已成立", $"訂單 {order.OrderNo} 已成立，請儘快完成付款，逾時未付款會自動取消。"),
        "PAID" => ("付款成功", $"訂單 {order.OrderNo} 已付款成功，我們會盡快為你備貨。"),
        "FULFILLING" => ("訂單備貨中", $"訂單 {order.OrderNo} 正在撿貨、包裝中。"),
        "SHIPPED" => ("訂單已寄出", $"訂單 {order.OrderNo} 已寄出，請留意收件。"),
        "COMPLETED" => ("訂單已完成", $"訂單 {order.OrderNo} 已完成，歡迎到商品頁留下你的評價。"),
        "CANCELLED" => ("訂單已取消", $"訂單 {order.OrderNo} 已取消，使用的優惠券與點數已退回。"),
        _ => null
    };
}
