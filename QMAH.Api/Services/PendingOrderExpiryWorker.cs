using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Services;

/// <summary>
/// 每分鐘取消超過時限仍待付款的信用卡訂單，與手動取消走同一個 <see cref="IStoreOrderCancellationService"/>。
/// 貨到付款訂單同樣以 PENDING_PAYMENT 建立，但付款發生在收貨時，所以不逾時。
/// 每筆取消前都要向綠界查詢，呼叫過快會被暫停查詢，因此每輪只處理少量訂單；
/// 這一輪處理不了的訂單隔一段時間再試，不讓它一直排在最前面擋住後面的訂單；試滿 <see cref="MaxAttempts"/> 次
/// 仍處理不了就記下錯誤並放棄，交給人工處理。
/// </summary>
public sealed class PendingOrderExpiryWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<StoreOrderOptions> options,
    ILogger<PendingOrderExpiryWorker> logger) : BackgroundService
{
    private const int BatchSize = 10;
    private const int MaxAttempts = 3;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMinutes(10);

    /// <summary>
    /// 處理不了的訂單：已失敗次數與下次可以再試的時間，放棄的訂單時間為 DateTime.MaxValue。
    /// 只存在記憶體，重啟後會從頭再試。
    /// </summary>
    private readonly Dictionary<Guid, (int Failures, DateTime RetryAt)> deferred = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await ExpireBatchAsync(stoppingToken);
                }
                catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogError(exception, "取消逾時待付款訂單時發生錯誤。");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // 停止服務會取消計時器等待與進行中的查詢，屬於正常結束，不應回報背景服務故障。
        }
    }

    private async Task ExpireBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var deferredIds = deferred.Where(pair => pair.Value.RetryAt > now).Select(pair => pair.Key).ToList();

        var cutoff = now.AddMinutes(-options.Value.PendingOrderTimeoutMinutes);
        List<Guid> ids;
        await using (var scope = scopeFactory.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
            ids = await db.StoreOrders
                .AsNoTracking()
                .Where(order => order.Status == "PENDING_PAYMENT"
                    && order.Payment != null
                    && order.Payment.PaymentType == "CREDIT_CARD"
                    && order.CreatedAt < cutoff
                    && !deferredIds.Contains(order.Id))
                .OrderBy(order => order.CreatedAt)
                .Select(order => order.Id)
                .Take(BatchSize)
                .ToListAsync(cancellationToken);
        }

        // 查詢沒有取滿代表符合條件的都在這一批：到期卻沒出現的訂單已經由別處付款或取消，不必再記。
        if (ids.Count < BatchSize)
        {
            foreach (var id in deferred.Where(pair => pair.Value.RetryAt <= now).Select(pair => pair.Key).Except(ids).ToList())
                deferred.Remove(id);
        }

        foreach (var id in ids)
        {
            StoreOrderCancelResult? result = null;
            try
            {
                // 每筆各自的 scope 與交易：一筆失敗只記 log，不影響其他筆。
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<IStoreOrderCancellationService>();
                result = await service.CancelAsync(id, userId: null, cancellationToken);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogError(exception, "逾時訂單取消失敗：{OrderId}", id);
            }

            if (result is not (null or StoreOrderCancelResult.PaymentStatusUnknown or StoreOrderCancelResult.PaymentNeedsReview))
            {
                deferred.Remove(id);
                if (result == StoreOrderCancelResult.Cancelled)
                    logger.LogInformation("已取消逾時未付款訂單：{OrderId}", id);
                continue;
            }

            // 訂單仍是待付款：先擱著，否則下一輪又會排在最前面。
            var failures = deferred.GetValueOrDefault(id).Failures + 1;
            if (failures >= MaxAttempts)
            {
                deferred[id] = (failures, DateTime.MaxValue);
                logger.LogError(
                    "逾時訂單已嘗試 {Attempts} 次仍無法取消，不再自動處理，需人工確認付款狀態：{OrderId}（最後結果 {Result}）",
                    failures,
                    id,
                    result?.ToString() ?? "Exception");
            }
            else
            {
                deferred[id] = (failures, now + RetryDelay);
            }

            if (result == StoreOrderCancelResult.PaymentStatusUnknown)
            {
                // 綠界查詢失敗可能是被暫停查詢（403）或網路問題，這一輪不再查其他筆。
                logger.LogWarning("無法向綠界確認付款狀態（第 {Attempt} 次），這一輪到此為止：{OrderId}", failures, id);
                break;
            }
        }
    }
}
