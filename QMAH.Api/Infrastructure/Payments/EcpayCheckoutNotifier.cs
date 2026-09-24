using System.Net;
using System.Security.Cryptography;
using System.Text;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>下單時要通知綠界（ECPay）測試環境用的內容。</summary>
public sealed record EcpayCheckoutRequest(
    string MerchantTradeNo,
    decimal TotalAmount,
    string TradeDesc,
    string ItemName);

/// <summary>瀏覽器可以直接送出、導向綠界結帳頁的表單內容。</summary>
public sealed record EcpayCheckoutFormDto(string ActionUrl, IReadOnlyDictionary<string, string> Fields);

public interface IEcpayCheckoutNotifier
{
    /// <summary>
    /// 呼叫綠界測試環境的 AioCheckOut／V5，模擬「信用卡付款」下單時通知金流商。
    /// 這不是完整的金流串接（沒有可對外的 ReturnURL 可以收 callback，也不會真的扣款），
    /// 只用來示範串接呼叫本身；因此呼叫失敗只記錄，不影響訂單是否成立。
    /// </summary>
    Task NotifyAsync(EcpayCheckoutRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// 綠界（ECPay）AioCheckOut／V5 的參數與簽章計算，純函式、不含任何 I/O，
/// EcpayCheckoutNotifier（伺服器端通知）與 OrderDto 的 EcpayCheckout 欄位
/// （交給瀏覽器直接送出、導向綠界測試付款頁）共用同一套邏輯，確保兩邊算出來的簽章一致。
/// </summary>
public static class EcpayCheckoutFormBuilder
{
    // integration: 綠界官方公開提供、給所有開發者共用的測試環境商店代號與金鑰，
    // 不是正式商店憑證，不會產生真實金流；正式上線前需換成商城自己申請的正式資訊，
    // 並改用真正可被綠界呼叫到的 ReturnURL 接收付款結果 callback。
    private const string MerchantId = "2000132";
    private const string HashKey = "5294y06JbISpM5x9";
    private const string HashIv = "v77hoKGq4kWxNNIS";
    public const string SandboxUrl = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

    public static EcpayCheckoutFormDto Build(EcpayCheckoutRequest request)
    {
        // integration: 綠界要求商店時間，官方文件以台灣時間（UTC+8）為準。
        var tradeDate = DateTime.UtcNow.AddHours(8).ToString("yyyy/MM/dd HH:mm:ss");
        var totalAmount = (int)Math.Round(request.TotalAmount, MidpointRounding.AwayFromZero);
        var parameters = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["MerchantID"] = MerchantId,
            ["MerchantTradeNo"] = request.MerchantTradeNo,
            ["MerchantTradeDate"] = tradeDate,
            ["PaymentType"] = "aio",
            ["TotalAmount"] = totalAmount.ToString(),
            ["TradeDesc"] = request.TradeDesc,
            ["ItemName"] = request.ItemName,
            // integration: 本機開發沒有可被綠界呼叫到的公開網址，付款結果 callback 收不到；
            // ClientBackURL 不需要綠界主動連得到，只是使用者在綠界頁面按「返回商店」時導去的連結，
            // 先固定指回本機前端首頁，正式環境需換成可被外部呼叫到的網域。
            ["ReturnURL"] = "https://localhost/api/v1/store/checkout/ecpay-return",
            ["ClientBackURL"] = "http://localhost:4200/store/products",
            ["ChoosePayment"] = "Credit",
            ["EncryptType"] = "1",
        };
        parameters["CheckMacValue"] = ComputeCheckMacValue(parameters);
        return new EcpayCheckoutFormDto(SandboxUrl, parameters);
    }

    /// <summary>
    /// 「信用卡付款」訂單才需要綠界表單；商品行數量較多時裁到綠界 ItemName 欄位的長度上限。
    /// 交易編號固定用訂單 Id 的前 20 碼英數字（不含連字號），符合 MerchantTradeNo 只能英數字、
    /// 最多 20 碼的規則，同一張訂單重複呼叫也會得到相同編號。
    /// </summary>
    public static EcpayCheckoutRequest? BuildRequestForOrder(StoreOrder order)
    {
        if (order.Payment?.PaymentType != "CREDIT_CARD")
            return null;

        var itemName = string.Join(
            '#',
            order.OrderDetails.Select(detail => $"{detail.ProductNameSnapshot} x{detail.Quantity}"));
        if (itemName.Length > 400)
            itemName = itemName[..400];

        return new EcpayCheckoutRequest(order.Id.ToString("N")[..20], order.TotalAmount, "QMAH 商城訂單", itemName);
    }

    /// <summary>
    /// 綠界官方的 CheckMacValue 演算法：依鍵名排序、URL encode 後轉小寫，
    /// 並比照 .NET 傳統 UrlEncode 的規則把幾個字元還原成未編碼狀態，再算 SHA256。
    /// </summary>
    private static string ComputeCheckMacValue(Dictionary<string, string> parameters)
    {
        var sorted = parameters
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{pair.Key}={pair.Value}");
        var raw = $"HashKey={HashKey}&{string.Join('&', sorted)}&HashIV={HashIv}";
        var encoded = WebUtility.UrlEncode(raw).ToLowerInvariant();
        encoded = encoded
            .Replace("%2d", "-")
            .Replace("%5f", "_")
            .Replace("%2e", ".")
            .Replace("%21", "!")
            .Replace("%2a", "*")
            .Replace("%28", "(")
            .Replace("%29", ")");
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(encoded));
        return Convert.ToHexString(hash).ToUpperInvariant();
    }
}

public sealed class EcpayCheckoutNotifier(
    HttpClient httpClient,
    ILogger<EcpayCheckoutNotifier> logger) : IEcpayCheckoutNotifier
{
    public async Task NotifyAsync(EcpayCheckoutRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var form = EcpayCheckoutFormBuilder.Build(request);
            using var content = new FormUrlEncodedContent(form.Fields);
            using var response = await httpClient.PostAsync(form.ActionUrl, content, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            // integration: 這支 API 一律回 200 並附上一整頁 HTML（選擇付款方式頁或錯誤頁），
            // 不是回 JSON；用回應內容有沒有出現「發生錯誤」字樣，粗略分辨 CheckMacValue／參數是否被接受。
            if (body.Contains("發生錯誤", StringComparison.Ordinal))
            {
                logger.LogWarning(
                    "綠界測試環境拒絕了這筆通知。MerchantTradeNo={MerchantTradeNo} StatusCode={StatusCode}",
                    request.MerchantTradeNo,
                    (int)response.StatusCode);
                return;
            }

            logger.LogInformation(
                "已通知綠界測試環境。MerchantTradeNo={MerchantTradeNo} StatusCode={StatusCode}",
                request.MerchantTradeNo,
                (int)response.StatusCode);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // integration: 這只是示範串接用的通知，不是真正的付款流程；訂單本身已經成立，
            // 綠界測試環境逾時或連不上都不該讓下單本身失敗。
            logger.LogWarning(exception, "通知綠界測試環境時發生例外。MerchantTradeNo={MerchantTradeNo}", request.MerchantTradeNo);
        }
    }
}
