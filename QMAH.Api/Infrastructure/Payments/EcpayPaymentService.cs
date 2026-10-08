using System.Data;
using System.Globalization;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using QMAH.Api.Controllers.V1;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>
/// 一筆綠界交易的結果，callback（ReturnURL）與查詢訂單（QueryTradeInfo）都轉成這個格式，
/// 再交給 <see cref="EcpayPaymentService.ApplyResultAsync"/> 套用。
/// </summary>
public sealed record EcpayPaymentResult(
    string MerchantTradeNo,
    bool Succeeded,
    string? TradeNo,
    int? TradeAmt,
    int? RtnCode,
    string? RtnMsg,
    bool Simulated)
{
    /// <summary>把 callback 表單轉成付款結果；欄位格式不對時回 null。</summary>
    public static EcpayPaymentResult? FromCallback(IReadOnlyDictionary<string, string> fields)
    {
        if (!fields.TryGetValue("MerchantTradeNo", out var merchantTradeNo) || string.IsNullOrEmpty(merchantTradeNo)
            || !fields.TryGetValue("RtnCode", out var rtnCodeText)
            || !int.TryParse(rtnCodeText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var rtnCode))
            return null;

        int? tradeAmt = fields.TryGetValue("TradeAmt", out var tradeAmtText)
            && int.TryParse(tradeAmtText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var amount)
                ? amount
                : null;
        return new EcpayPaymentResult(
            merchantTradeNo,
            rtnCode == 1,
            fields.GetValueOrDefault("TradeNo"),
            tradeAmt,
            rtnCode,
            fields.GetValueOrDefault("RtnMsg"),
            fields.GetValueOrDefault("SimulatePaid") == "1");
    }
}

/// <summary>套用付款結果後要回給綠界的內容：Accepted 時回 1|OK，否則綠界會稍後重送。</summary>
public sealed record EcpayApplyOutcome(bool Accepted, string Reason)
{
    public static readonly EcpayApplyOutcome Ok = new(true, "OK");
}

/// <summary>
/// 綠界付款嘗試與付款結果。每次產生表單都記一筆 PaymentAttempt（綠界不允許重複編號，
/// 使用者也可能開兩個付款頁），callback 與取消前的查詢都以 MerchantTradeNo 經它找回訂單。
/// </summary>
public sealed class EcpayPaymentService(
    QmahDbContext db,
    IOptions<EcpayOptions> options,
    ILogger<EcpayPaymentService> logger)
{
    private const int MaxRtnMsgLength = 200;

    /// <summary>
    /// 為待付款的信用卡訂單新增一筆付款嘗試並回傳表單；其他訂單回 null。
    /// 只加入追蹤，由呼叫端的 SaveChanges 一起寫入。
    /// </summary>
    public EcpayCheckoutFormDto? AddCheckoutForm(StoreOrder order)
    {
        var request = EcpayCheckoutFormBuilder.BuildRequestForOrder(order);
        if (request is null)
            return null;

        db.PaymentAttempts.Add(new PaymentAttempt
        {
            Id = Guid.NewGuid(),
            PaymentId = order.Payment!.Id,
            MerchantTradeNo = request.MerchantTradeNo,
            Status = "CREATED",
            CreatedAt = DateTime.UtcNow
        });
        return EcpayCheckoutFormBuilder.Build(request, options.Value);
    }

    /// <summary>
    /// 套用一筆付款結果。在 Serializable 交易內重新載入訂單與付款，與取消流程互斥；
    /// 綠界會重送 callback，所以同一筆交易重複套用結果不變、點數不重複入帳。
    /// </summary>
    public async Task<EcpayApplyOutcome> ApplyResultAsync(EcpayPaymentResult result, CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                retryToken);

            var attempt = await db.PaymentAttempts
                .Include(item => item.Payment)
                    .ThenInclude(payment => payment.Order)
                .SingleOrDefaultAsync(item => item.MerchantTradeNo == result.MerchantTradeNo, retryToken);
            if (attempt is null)
            {
                logger.LogWarning("綠界付款結果找不到付款嘗試：{MerchantTradeNo}", result.MerchantTradeNo);
                return new EcpayApplyOutcome(false, "MerchantTradeNo not found");
            }

            var payment = attempt.Payment;
            var order = payment.Order;
            if (result.Simulated)
            {
                // 綠界測試介接說明：模擬付款（SimulatePaid=1）不應改變訂單狀態。
                logger.LogInformation("綠界模擬付款通知，不變更訂單：{MerchantTradeNo}", result.MerchantTradeNo);
                return EcpayApplyOutcome.Ok;
            }
            if (attempt.Status is "PAID" or "REFUND_REQUIRED")
                return EcpayApplyOutcome.Ok;

            var now = DateTime.UtcNow;
            var rtnMsg = Truncate(result.RtnMsg);
            attempt.RtnCode = result.RtnCode;
            attempt.RtnMsg = rtnMsg;
            attempt.CallbackReceivedAt = now;

            if (!result.Succeeded)
            {
                // 付款失敗：訂單維持待付款，使用者可用新的付款嘗試重付；已付款或已取消的訂單不受影響。
                attempt.Status = "FAILED";
                if (order.Status == "PENDING_PAYMENT" && payment.Status is "PENDING" or "FAILED")
                {
                    payment.Status = "FAILED";
                    payment.RtnCode = result.RtnCode;
                    payment.RtnMsg = rtnMsg;
                    payment.CallbackReceivedAt = now;
                }
            }
            else
            {
                var expectedAmount = EcpayCheckoutFormBuilder.ToTradeAmount(payment.Amount);
                if (result.TradeAmt != expectedAmount)
                {
                    logger.LogError(
                        "綠界付款金額不符，不變更訂單：{MerchantTradeNo} 收到 {TradeAmt}，應為 {ExpectedAmount}",
                        result.MerchantTradeNo,
                        result.TradeAmt,
                        expectedAmount);
                    return new EcpayApplyOutcome(false, "TradeAmt mismatch");
                }

                attempt.EcpayTradeNo = result.TradeNo;
                if (order.Status == "PENDING_PAYMENT")
                {
                    attempt.Status = "PAID";
                    order.Status = "PAID";
                    order.PaidAt = now;
                    RecordPayment(payment, "PAID", result, rtnMsg, now);
                    await GrantOrderRewardAsync(order, now, retryToken);
                }
                else if (order.Status == "CANCELLED")
                {
                    // 取消或逾時後才付款：不把訂單改回已付款，交給客服在綠界後台人工退款。
                    attempt.Status = "REFUND_REQUIRED";
                    if (payment.Status != "PAID")
                        RecordPayment(payment, "REFUND_REQUIRED", result, rtnMsg, now);
                    logger.LogWarning(
                        "訂單已取消後才收到綠界付款，需人工退款：{OrderNo} {MerchantTradeNo}",
                        order.OrderNo,
                        result.MerchantTradeNo);
                }
                else if (payment.EcpayTradeNo == result.TradeNo)
                {
                    attempt.Status = "PAID";
                }
                else
                {
                    // 兩個付款頁都付款成功：訂單維持第一筆付款，後到的這筆標記在付款嘗試上等待人工退款。
                    attempt.Status = "REFUND_REQUIRED";
                    logger.LogWarning(
                        "訂單重複付款，需人工退款：{OrderNo} {MerchantTradeNo} 綠界交易 {TradeNo}",
                        order.OrderNo,
                        result.MerchantTradeNo,
                        result.TradeNo);
                }
            }

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return EcpayApplyOutcome.Ok;
        }, cancellationToken);
    }

    private static void RecordPayment(Payment payment, string status, EcpayPaymentResult result, string? rtnMsg, DateTime now)
    {
        payment.Status = status;
        payment.EcpayTradeNo = result.TradeNo;
        payment.RtnCode = result.RtnCode;
        payment.RtnMsg = rtnMsg;
        payment.CallbackReceivedAt = now;
    }

    /// <summary>付款完成才入帳回饋點數，與 OrderDto.PointsEarned 的試算規則相同。</summary>
    private async Task GrantOrderRewardAsync(StoreOrder order, DateTime now, CancellationToken cancellationToken)
    {
        var reward = (int)Math.Floor(order.TotalAmount * StoreCheckoutCatalog.PointEarnRate);
        // PointTransactions.Amount 不可為 0（CK_PointTransactions_Amount），小額訂單沒有回饋就不寫流水。
        if (reward <= 0)
            return;

        var balance = await db.PointBalances.SingleOrDefaultAsync(item => item.UserId == order.UserId, cancellationToken);
        if (balance is null)
        {
            balance = new PointBalance { UserId = order.UserId, Balance = 0 };
            db.PointBalances.Add(balance);
        }
        balance.Balance += reward;
        balance.UpdatedAt = now;
        db.PointTransactions.Add(new PointTransaction
        {
            Id = Guid.NewGuid(),
            UserId = order.UserId,
            Amount = reward,
            Reason = "ORDER_REWARD",
            ReferenceType = "ORDER",
            ReferenceId = order.Id,
            CreatedAt = now
        });
    }

    private static string? Truncate(string? value) =>
        value is { Length: > MaxRtnMsgLength } ? value[..MaxRtnMsgLength] : value;
}
