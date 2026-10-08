using System.Globalization;

using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>QueryTradeInfo/V5 回傳的交易狀態；TradeStatus 為 1 才是已付款。</summary>
public sealed record EcpayTradeInfo(string MerchantTradeNo, string TradeStatus, string? TradeNo, int? TradeAmt)
{
    public bool IsPaid => TradeStatus == "1";

    public EcpayPaymentResult ToPaymentResult() =>
        new(MerchantTradeNo, IsPaid, TradeNo, TradeAmt, IsPaid ? 1 : null, $"QueryTradeInfo TradeStatus={TradeStatus}", false);
}

/// <summary>
/// 綠界查詢訂單 API，只在取消前查詢該筆訂單的付款嘗試，不做輪詢：呼叫過快會被回 HTTP 403，
/// 之後要等一段時間才能再查。查不到結果（網路錯誤、403、檢查碼不符）一律回 null，呼叫端不可在不確定時取消。
/// </summary>
public sealed class EcpayQueryClient(
    HttpClient http,
    IOptions<EcpayOptions> options,
    ILogger<EcpayQueryClient> logger)
{
    public async Task<EcpayTradeInfo?> QueryAsync(string merchantTradeNo, CancellationToken cancellationToken)
    {
        var o = options.Value;
        var fields = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["MerchantID"] = o.MerchantId,
            ["MerchantTradeNo"] = merchantTradeNo,
            // TimeStamp 只有 3 分鐘有效，伺服器時間必須準確。
            ["TimeStamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)
        };
        fields["CheckMacValue"] = EcpayCheckMac.Compute(fields, o.HashKey, o.HashIv);

        string body;
        try
        {
            using var response = await http.PostAsync(o.QueryTradeInfoUrl, new FormUrlEncodedContent(fields), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                // 403 = 呼叫過快，需等待後再試。
                logger.LogWarning("綠界查詢訂單失敗：{MerchantTradeNo} HTTP {StatusCode}", merchantTradeNo, (int)response.StatusCode);
                return null;
            }
            body = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "綠界查詢訂單連線失敗：{MerchantTradeNo}", merchantTradeNo);
            return null;
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "綠界查詢訂單逾時：{MerchantTradeNo}", merchantTradeNo);
            return null;
        }

        var parsed = QueryHelpers.ParseQuery(body)
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToString(), StringComparer.Ordinal);
        if (parsed.ContainsKey("CheckMacValue") && !EcpayCheckMac.Verify(parsed, o))
        {
            logger.LogWarning("綠界查詢訂單回應檢查碼不符：{MerchantTradeNo}", merchantTradeNo);
            return null;
        }
        if (!parsed.TryGetValue("TradeStatus", out var tradeStatus) || string.IsNullOrEmpty(tradeStatus)
            || parsed.GetValueOrDefault("MerchantTradeNo") is { Length: > 0 } returned && returned != merchantTradeNo)
        {
            logger.LogWarning("綠界查詢訂單回應格式不符：{MerchantTradeNo}", merchantTradeNo);
            return null;
        }

        int? tradeAmt = int.TryParse(parsed.GetValueOrDefault("TradeAmt"), NumberStyles.Integer, CultureInfo.InvariantCulture, out var amount)
            ? amount
            : null;
        var tradeNo = parsed.GetValueOrDefault("TradeNo");
        return new EcpayTradeInfo(merchantTradeNo, tradeStatus, string.IsNullOrEmpty(tradeNo) ? null : tradeNo, tradeAmt);
    }
}
