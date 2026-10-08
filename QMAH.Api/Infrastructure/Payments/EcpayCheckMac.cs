using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>
/// 綠界 CheckMacValue（SHA256）演算法，送出表單、驗證 callback 與查詢訂單共用同一份實作。
/// </summary>
public static class EcpayCheckMac
{
    /// <summary>
    /// 除 CheckMacValue 外的欄位全部參與計算：依鍵名 Ordinal 排序、前後加上 HashKey／HashIV、
    /// URL encode 後轉小寫，再算 SHA256。WebUtility.UrlEncode 與綠界規則相同，不編碼 -_.!*()。
    /// 呼叫端傳入的必須是已解碼的值（ASP.NET 讀表單時已解碼，不可再 decode 一次）。
    /// </summary>
    public static string Compute(IReadOnlyDictionary<string, string> fields, string hashKey, string hashIv)
    {
        var sorted = fields
            .Where(pair => pair.Key != "CheckMacValue")
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{pair.Key}={pair.Value}");
        var raw = $"HashKey={hashKey}&{string.Join('&', sorted)}&HashIV={hashIv}";
        var encoded = WebUtility.UrlEncode(raw).ToLowerInvariant();
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(encoded)));
    }

    /// <summary>
    /// 驗證綠界送來的欄位：MerchantID 必須是自己的商店，CheckMacValue 以固定時間比對，避免被時間差推測。
    /// </summary>
    public static bool Verify(IReadOnlyDictionary<string, string> fields, EcpayOptions options)
    {
        if (!fields.TryGetValue("CheckMacValue", out var received) || string.IsNullOrEmpty(received))
            return false;
        if (!fields.TryGetValue("MerchantID", out var merchantId) || merchantId != options.MerchantId)
            return false;

        var expected = Compute(fields, options.HashKey, options.HashIv);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expected),
            Encoding.ASCII.GetBytes(received.ToUpperInvariant()));
    }
}
