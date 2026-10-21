using System.Data;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Store;

public enum PendingOrderCancelOutcome
{
    Cancelled,
    AlreadyCancelled,
    NotFound,
    NotCancellable,
    AlreadyPaid
}

/// <summary>前台取消、逾時取消與後台取消共用：在同一筆交易內取消待付款訂單並回補庫存、優惠券與點數。</summary>
/// <remarks>呼叫端必須先確認金流沒有收款；這裡只處理資料庫內的狀態。</remarks>
public static class StoreOrderCancellation
{
    /// <param name="userId">會員取消時只能取消自己的訂單；背景逾時取消與後台取消傳 null。</param>
    public static async Task<PendingOrderCancelOutcome> CancelPendingAsync(
        QmahDbContext db,
        Guid orderId,
        Guid? userId,
        CancellationToken cancellationToken)
    {
        // integration: 取消也使用完整 execution strategy，避免暫時性 SQL 失敗時只回補了部分資產。
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                retryToken);
            var order = await db.StoreOrders
                .Include(item => item.OrderDetails)
                    .ThenInclude(detail => detail.Product)
                .Include(item => item.Payment)
                .Include(item => item.UserCoupon)
                .SingleOrDefaultAsync(item => item.Id == orderId && (userId == null || item.UserId == userId), retryToken);
            if (order is null)
                return PendingOrderCancelOutcome.NotFound;
            if (order.Status == "CANCELLED")
                return PendingOrderCancelOutcome.AlreadyCancelled;
            // 查詢與取消之間剛好到達的 callback 已把訂單改成已付款時，這裡會擋下來。
            // integration: PAID 訂單不可由取消流程假裝完成退款，請交由退款／客服流程處理。
            if (order.Status == "PAID")
                return PendingOrderCancelOutcome.AlreadyPaid;
            if (order.Status != "PENDING_PAYMENT")
                return PendingOrderCancelOutcome.NotCancellable;

            // integration: 取消必須在同一交易中回補庫存、優惠券與點數，避免只回復部分資產。
            var now = DateTime.UtcNow;
            order.Status = "CANCELLED";
            order.CancelledAt = now;
            if (order.Payment is not null && order.Payment.Status == "PENDING")
            {
                order.Payment.Status = "CANCELLED";
                order.Payment.CallbackReceivedAt = now;
            }
            foreach (var detail in order.OrderDetails)
            {
                detail.Product.Stock += detail.Quantity;
                detail.Product.UpdatedAt = now;
            }
            if (order.UserCoupon is not null && order.UserCoupon.Status == "USED")
            {
                order.UserCoupon.Status = "AVAILABLE";
                order.UserCoupon.UsedAt = null;
            }
            if (order.PointsUsed > 0)
            {
                var balance = await db.PointBalances
                    .SingleOrDefaultAsync(item => item.UserId == order.UserId, retryToken)
                    ?? throw new InvalidOperationException("訂單點數退款時找不到會員點數帳戶。");
                balance.Balance += order.PointsUsed;
                balance.UpdatedAt = now;
                db.PointTransactions.Add(new PointTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = order.UserId,
                    Amount = order.PointsUsed,
                    Reason = "ORDER_CANCEL_REFUND",
                    ReferenceType = "ORDER",
                    ReferenceId = order.Id,
                    CreatedAt = now
                });
            }

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return PendingOrderCancelOutcome.Cancelled;
        }, cancellationToken);
    }
}
