using System.ComponentModel.DataAnnotations;

using Microsoft.EntityFrameworkCore;

using QMAH.Api.Infrastructure.Payments;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Services.Store;

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
        var outcome = await StoreOrderCancellation.CancelPendingAsync(db, orderId, userId, cancellationToken);
        return outcome switch
        {
            PendingOrderCancelOutcome.Cancelled => StoreOrderCancelResult.Cancelled,
            PendingOrderCancelOutcome.AlreadyCancelled => StoreOrderCancelResult.AlreadyCancelled,
            PendingOrderCancelOutcome.NotFound => StoreOrderCancelResult.NotFound,
            PendingOrderCancelOutcome.AlreadyPaid => StoreOrderCancelResult.AlreadyPaid,
            _ => StoreOrderCancelResult.NotCancellable
        };
    }
}
