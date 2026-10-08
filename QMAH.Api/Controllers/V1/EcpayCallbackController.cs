using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

using QMAH.Api.Infrastructure.Payments;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 綠界付款結果通知（ReturnURL）。由綠界伺服器以 form POST 呼叫，沒有登入也沒有 anti-forgery token，
/// 所以不繼承 ApiControllerBase；回應必須是純文字 1|OK，否則綠界會隔幾分鐘重送。
/// </summary>
[ApiController]
[AllowAnonymous]
[IgnoreAntiforgeryToken]
[Route("api/v1/store/checkout")]
public sealed class EcpayCallbackController(
    EcpayPaymentService payments,
    IOptions<EcpayOptions> options,
    ILogger<EcpayCallbackController> logger) : ControllerBase
{
    [HttpPost("ecpay-return")]
    [Consumes("application/x-www-form-urlencoded")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> Return(CancellationToken cancellationToken)
    {
        // ASP.NET 讀表單時已解碼，直接用解碼後的值驗證，不能再 URL decode 一次。
        var form = await Request.ReadFormAsync(cancellationToken);
        var fields = form.ToDictionary(pair => pair.Key, pair => pair.Value.ToString(), StringComparer.Ordinal);
        var merchantTradeNo = fields.GetValueOrDefault("MerchantTradeNo");

        if (!EcpayCheckMac.Verify(fields, options.Value))
        {
            logger.LogWarning("綠界 callback 檢查碼不符：{MerchantTradeNo}", merchantTradeNo);
            return BadRequest("0|CheckMacValue Error");
        }

        var result = EcpayPaymentResult.FromCallback(fields);
        if (result is null)
        {
            logger.LogWarning("綠界 callback 欄位格式不符：{MerchantTradeNo}", merchantTradeNo);
            return BadRequest("0|Invalid Fields");
        }

        var outcome = await payments.ApplyResultAsync(result, cancellationToken);
        return outcome.Accepted
            ? Content("1|OK", "text/plain")
            : BadRequest($"0|{outcome.Reason}");
    }
}
