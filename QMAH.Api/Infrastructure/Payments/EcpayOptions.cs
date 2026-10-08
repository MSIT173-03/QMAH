using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Sockets;

using Microsoft.Extensions.Options;

namespace QMAH.Api.Infrastructure.Payments;

/// <summary>
/// 綠界商店代號、金鑰與端點網址。正式金鑰只放環境變數（Ecpay__HashKey 等）或 secret 管理服務，
/// 不進版本庫；端點網址刻意沒有預設值，漏設時啟動就失敗，避免正式環境悄悄連到測試網址。
/// </summary>
public sealed class EcpayOptions
{
    public const string SectionName = "Ecpay";

    [Required] public string MerchantId { get; set; } = "";
    [Required] public string HashKey { get; set; } = "";
    [Required] public string HashIv { get; set; } = "";
    /// <summary>AioCheckOut/V5 端點，測試與正式環境不同。</summary>
    [Required, Url] public string CheckoutUrl { get; set; } = "";
    /// <summary>QueryTradeInfo/V5 端點，測試與正式環境不同。</summary>
    [Required, Url] public string QueryTradeInfoUrl { get; set; } = "";
    /// <summary>API 對外的 HTTPS 網址，綠界伺服器以它組出的 ReturnURL 回傳付款結果。</summary>
    [Required, Url] public string PublicBaseUrl { get; set; } = "";
    /// <summary>前端網址；使用者在綠界頁面按「返回商店」時回到這裡的我的訂單頁。</summary>
    [Required, Url] public string ClientBaseUrl { get; set; } = "";

    public string ReturnUrl => $"{PublicBaseUrl.TrimEnd('/')}/{EcpayRoutes.Callback}";
    public string ClientBackUrl => $"{ClientBaseUrl.TrimEnd('/')}/{EcpayRoutes.ClientOrders}";
}

/// <summary>控制器路由與表單網址共用的路徑，避免只改其中一邊而對不起來。</summary>
public static class EcpayRoutes
{
    public const string Callback = "api/v1/store/checkout/ecpay-return";
    public const string ClientOrders = "store/orders";
}

/// <summary>
/// 非開發環境的網址檢查：ReturnURL 由綠界伺服器呼叫，官方只支援 443 port 與合法網域，
/// 所以 PublicBaseUrl 必須是 https、不是本機或私有位址、不指定其他 port；前端網址也不可是 localhost。
/// </summary>
public sealed class EcpayOptionsValidator(IHostEnvironment environment) : IValidateOptions<EcpayOptions>
{
    public ValidateOptionsResult Validate(string? name, EcpayOptions options)
    {
        if (environment.IsDevelopment())
            return ValidateOptionsResult.Success;

        var failures = new List<string>();
        if (!Uri.TryCreate(options.PublicBaseUrl, UriKind.Absolute, out var publicUri)
            || publicUri.Scheme != Uri.UriSchemeHttps
            || !publicUri.IsDefaultPort
            || IsLocalOrPrivate(publicUri))
            failures.Add("Ecpay:PublicBaseUrl 必須是綠界連得到的 https 網址（443 port、不是 localhost 或私有位址）。");
        if (!Uri.TryCreate(options.ClientBaseUrl, UriKind.Absolute, out var clientUri) || clientUri.IsLoopback)
            failures.Add("Ecpay:ClientBaseUrl 不可是 localhost。");

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static bool IsLocalOrPrivate(Uri uri)
    {
        if (uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!IPAddress.TryParse(uri.Host, out var address))
            return false;
        if (address.AddressFamily == AddressFamily.InterNetworkV6)
            return address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6UniqueLocal;

        var bytes = address.GetAddressBytes();
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168)
            || (bytes[0] == 169 && bytes[1] == 254);
    }
}
