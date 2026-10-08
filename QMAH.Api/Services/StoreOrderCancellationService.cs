using System.ComponentModel.DataAnnotations;
using System.Data;

using Microsoft.EntityFrameworkCore;

using QMAH.Api.Infrastructure.Payments;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Services;

/// <summary>商城訂單流程設定。</summary>
public sealed class StoreOrderOptions
{
    public const string SectionName = "Store";

    /// <summary>信用卡訂單建立後多久仍未付款就自動取消。</summary>
    [Range(1, 7 * 24 * 60)]
    public int PendingOrderTimeoutMinutes { get; set; } = 30;
}

public enum StoreOrderCancelResult
{
    Cancelled,
    AlreadyCancelled,
    NotFound,
    NotCancellable,
    /// <summary>綠界確認已付款，訂單已轉為已付款，沒有取消。</summary>
    AlreadyPaid,
    /// <summary>無法向綠界確認付款狀態；寧可晚一點取消，也不在不確定時取消。</summary>
    PaymentStatusUnknown,
    /// <summary>綠界已收款但無法補記（例如金額不符），訂單維持待付款，需人工核對。</summary>
    PaymentNeedsReview
}

/// <summary>手動取消與逾時取消共用的流程：先向綠界確認沒有付款，再在同一筆交易內回補庫存、優惠券與點數。</summary>
public interface IStoreOrderCancellationService
{
    /// <param name="userId">手動取消時為會員 Id，只能取消自己的訂單；背景逾時取消傳 null。</param>
    Task<StoreOrderCancelResult> CancelAsync(Guid orderId, Guid? userId, CancellationToken cancellationToken);
}

public sealed class StoreOrderCancellationService(
    QmahDbContext db,
    EcpayQueryClient ecpayQuery,
    EcpayPaymentService payments,
    ILogger<StoreOrderCancellationService> logger) : IStoreOrderCancellationService
{
    public async Task<StoreOrderCancelResult> CancelAsync(Guid orderId, Guid? userId, CancellationToken cancellationToken)
    {
        // 第一步不開交易：查詢綠界是外部 HTTP 呼叫，不能持有 Serializable 鎖等待網路。
        var snapshot = await db.StoreOrders
            .AsNoTracking()
            .Where(order => order.Id == orderId && (userId == null || order.UserId == userId))
            .Select(order => new
            {
                order.Status,
                PaymentType = order.Payment == null ? null : order.Payment.PaymentType,
                TradeNos = order.Payment == null
                    ? new List<string>()
                    : order.Payment.PaymentAttempts.Select(attempt => attempt.MerchantTradeNo).ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (snapshot is null)
            return StoreOrderCancelResult.NotFound;
        if (snapshot.Status == "CANCELLED")
            return StoreOrderCancelResult.AlreadyCancelled;
        if (snapshot.Status != "PENDING_PAYMENT")
            return StoreOrderCancelResult.NotCancellable;

        if (snapshot.PaymentType == "CREDIT_CARD")
        {
            foreach (var tradeNo in snapshot.TradeNos)
            {
                var info = await ecpayQuery.QueryAsync(tradeNo, cancellationToken);
                if (info is null)
                    return StoreOrderCancelResult.PaymentStatusUnknown;
                if (!info.IsPaid)
                    continue;

                // callback 漏接但綠界已收款：補記付款，不取消。
                var outcome = await payments.ApplyResultAsync(info.ToPaymentResult(), cancellationToken);
                if (outcome.Accepted)
                    return StoreOrderCancelResult.AlreadyPaid;

                logger.LogError(
                    "綠界查詢為已付款但無法補記付款，訂單維持待付款，需人工核對：{OrderId} {MerchantTradeNo} {Reason}",
                    orderId,
                    tradeNo,
                    outcome.Reason);
                return StoreOrderCancelResult.PaymentNeedsReview;
            }
        }

        return await CancelPendingOrderAsync(orderId, userId, cancellationToken);
    }

    private async Task<StoreOrderCancelResult> CancelPendingOrderAsync(
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
                return StoreOrderCancelResult.NotFound;
            if (order.Status == "CANCELLED")
                return StoreOrderCancelResult.AlreadyCancelled;
            // 查詢與取消之間剛好到達的 callback 已把訂單改成已付款時，這裡會擋下來。
            // integration: PAID 訂單不可由取消 API 假裝完成退款，請交由退款／客服流程處理。
            if (order.Status == "PAID")
                return StoreOrderCancelResult.AlreadyPaid;
            if (order.Status != "PENDING_PAYMENT")
                return StoreOrderCancelResult.NotCancellable;

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
            return StoreOrderCancelResult.Cancelled;
        }, cancellationToken);
    }
}
