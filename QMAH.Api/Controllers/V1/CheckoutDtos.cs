using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 結帳頁配送／付款方式的模擬選項目錄。選項本身（代碼、名稱、運費）不落地成資料表，
/// 固定寫死在後端；訂單成立時才把實際套用的配送方式代碼與運費寫回 StoreOrders，
/// 付款方式代碼則沿用既有的 Payment.PaymentType 欄位，避免為此另外建表。
/// </summary>
public static class StoreCheckoutCatalog
{
    public sealed record ShippingOptionDef(string Id, string Name, decimal BaseFee);

    public sealed record PaymentOptionDef(string Id, string Name);

    public static readonly IReadOnlyList<ShippingOptionDef> ShippingOptions =
    [
        new("STANDARD", "宅配到府", 80m),
        new("CVS", "超商取貨", 60m),
    ];

    public static readonly IReadOnlyList<PaymentOptionDef> PaymentOptions =
    [
        new("COD", "貨到付款"),
        new("CREDIT_CARD", "信用卡付款"),
    ];

    /// <summary>滿額免運門檻（依折扣後、折價券前的商品小計計算）。</summary>
    public const decimal FreeShippingThreshold = 1500m;

    /// <summary>訂單完成後回饋的點數比例，以應付總額計算。</summary>
    public const decimal PointEarnRate = 0.01m;

    public static ShippingOptionDef? FindShippingOption(string id) =>
        ShippingOptions.FirstOrDefault(option => option.Id == id);

    public static PaymentOptionDef? FindPaymentOption(string id) =>
        PaymentOptions.FirstOrDefault(option => option.Id == id);

    /// <summary>依免運門檻換算指定配送方式在本次訂單的實際運費。</summary>
    public static decimal ResolveShippingFee(ShippingOptionDef option, decimal subtotal) =>
        subtotal >= FreeShippingThreshold ? 0m : option.BaseFee;
}

public sealed record ShippingOptionDto(string Id, string Name, decimal Fee);

public sealed record PaymentOptionDto(string Id, string Name);

/// <summary>結帳選項與規則；配送方式的 fee 是目錄原價，購物車與試算頁面再各自套用免運門檻。</summary>
public sealed record CheckoutOptionsDto(
    IReadOnlyList<ShippingOptionDto> ShippingOptions,
    IReadOnlyList<PaymentOptionDto> PaymentOptions,
    decimal FreeShippingThreshold,
    decimal PointEarnRate);

public sealed class OrderQuoteRequestDto
{
    [Required, StringLength(40, MinimumLength = 1)]
    public string ShippingOptionId { get; set; } = "";

    public Guid? CouponId { get; set; }

    [Range(0, int.MaxValue)]
    public int UsePoints { get; set; }
}

public sealed record OrderQuoteLineDto(Guid ProductId, string Name, int Qty, decimal LineTotal);

/// <summary>訂單試算結果；只讀取購物車與會員資產做預覽，不寫入任何資料。</summary>
public sealed record OrderQuoteDto(
    IReadOnlyList<OrderQuoteLineDto> Lines,
    decimal Subtotal,
    // 商品折扣已內含於 Subtotal（EffectivePrice 已套用 SalePrice／DiscountRate），
    // 跟既有 POST /store/orders 的既有慣例一致，這裡固定回 0，不重複列一行。
    decimal ItemDiscount,
    decimal ShippingFee,
    decimal CouponDiscount,
    int PointsUsed,
    decimal Payable,
    int PointsEarned,
    IReadOnlyList<ShippingOptionDto> ShippingOptions,
    IReadOnlyList<string> UsableCouponIds,
    int PointCap);
