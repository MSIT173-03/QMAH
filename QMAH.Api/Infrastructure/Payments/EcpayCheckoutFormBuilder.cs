using System.Security.Cryptography;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>要交給綠界（ECPay）建立交易用的內容。</summary>
public sealed record EcpayCheckoutRequest(
    string MerchantTradeNo,
    decimal TotalAmount,
    string TradeDesc,
    string ItemName);

/// <summary>瀏覽器可以直接送出、導向綠界結帳頁的表單內容。</summary>
public sealed record EcpayCheckoutFormDto(string ActionUrl, IReadOnlyDictionary<string, string> Fields);

/// <summary>
/// 綠界（ECPay）AioCheckOut／V5 的參數與簽章計算，純函式、不含任何 I/O；商店代號、金鑰與網址由
/// EcpayOptions 傳入。結果交給瀏覽器直接送出、導向綠界付款頁。
/// 建立交易的動作只能由瀏覽器那一次 POST 完成：綠界以 MerchantTradeNo 判斷交易是否已存在，
/// 伺服器端若先送一次，瀏覽器再送同一個編號就會看到「訂單編號重覆，建立失敗」。
/// 每個編號都要先記在 PaymentAttempts（見 EcpayPaymentService），callback 才找得回訂單。
/// </summary>
public static class EcpayCheckoutFormBuilder
{
    private const string TradeNoAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    public static EcpayCheckoutFormDto Build(EcpayCheckoutRequest request, EcpayOptions options)
    {
        // integration: 綠界要求商店時間，官方文件以台灣時間（UTC+8）為準。
        var tradeDate = DateTime.UtcNow.AddHours(8).ToString("yyyy/MM/dd HH:mm:ss");
        var parameters = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["MerchantID"] = options.MerchantId,
            ["MerchantTradeNo"] = request.MerchantTradeNo,
            ["MerchantTradeDate"] = tradeDate,
            ["PaymentType"] = "aio",
            ["TotalAmount"] = ToTradeAmount(request.TotalAmount).ToString(),
            ["TradeDesc"] = request.TradeDesc,
            ["ItemName"] = request.ItemName,
            // ReturnURL 由綠界伺服器呼叫，付款結果以它為準；ClientBackURL 只是使用者按「返回商店」
            // 時瀏覽器前往的我的訂單頁，不能拿來判斷付款成敗。兩者不可設成同一個位置。
            ["ReturnURL"] = options.ReturnUrl,
            ["ClientBackURL"] = options.ClientBackUrl,
            ["ChoosePayment"] = "Credit",
            ["EncryptType"] = "1",
        };
        parameters["CheckMacValue"] = EcpayCheckMac.Compute(parameters, options.HashKey, options.HashIv);
        return new EcpayCheckoutFormDto(options.CheckoutUrl, parameters);
    }

    /// <summary>送給綠界的整數金額；callback 的 TradeAmt 也用同一個規則核對。</summary>
    public static int ToTradeAmount(decimal amount) =>
        (int)Math.Round(amount, MidpointRounding.AwayFromZero);

    /// <summary>
    /// 只有「信用卡付款」且仍待付款的訂單才產生綠界表單；已取消、已付款的訂單拿不到可送出的表單。
    /// 商品行數量較多時裁到綠界 ItemName 欄位的長度上限。
    /// 交易編號為「訂單 Id 前 8 碼＋12 碼隨機英數字」共 20 碼，符合 MerchantTradeNo 只能英數字、
    /// 最多 20 碼的規則；同一秒內連續產生也不會重複（綠界不允許同一編號重複建立交易）。
    /// </summary>
    public static EcpayCheckoutRequest? BuildRequestForOrder(StoreOrder order)
    {
        if (order.Status != "PENDING_PAYMENT" || order.Payment?.PaymentType != "CREDIT_CARD")
            return null;

        var itemName = string.Join(
            '#',
            order.OrderDetails.Select(detail => $"{detail.ProductNameSnapshot} x{detail.Quantity}"));
        if (itemName.Length > 400)
            itemName = itemName[..400];

        var tradeNo = $"{order.Id:N}"[..8].ToUpperInvariant()
            + RandomNumberGenerator.GetString(TradeNoAlphabet, 12);
        return new EcpayCheckoutRequest(tradeNo, order.TotalAmount, "QMAH 商城訂單", itemName);
    }
}
