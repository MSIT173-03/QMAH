using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 結帳頁的配送／付款選項與訂單試算。選項目錄固定在 StoreCheckoutCatalog，
/// 試算只讀取購物車、折價券與點數資產，不寫入任何資料；正式成立訂單仍由
/// StoreOrdersController 的 POST /store/orders 負責，兩邊的折價券與點數規則需保持一致。
/// </summary>
[Authorize]
[Route("api/v1/store/checkout")]
public sealed class StoreCheckoutController(QmahDbContext db) : ApiControllerBase
{
    [HttpGet("options")]
    public ActionResult<CheckoutOptionsDto> GetOptions() =>
        Ok(new CheckoutOptionsDto(
            StoreCheckoutCatalog.ShippingOptions
                .Select(option => new ShippingOptionDto(option.Id, option.Name, option.BaseFee))
                .ToList(),
            StoreCheckoutCatalog.PaymentOptions
                .Select(option => new PaymentOptionDto(option.Id, option.Name))
                .ToList(),
            StoreCheckoutCatalog.FreeShippingThreshold,
            StoreCheckoutCatalog.PointEarnRate));

    [HttpPost("quote")]
    public async Task<ActionResult<OrderQuoteDto>> GetQuote(
        OrderQuoteRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var shippingOption = StoreCheckoutCatalog.FindShippingOption(request.ShippingOptionId);
        if (shippingOption is null)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "配送方式無效", detail: "請選擇有效的配送方式。");

        var cartItems = await db.CartItems
            .AsNoTracking()
            .Include(item => item.Product)
            .Where(item => item.UserId == userId)
            .ToListAsync(cancellationToken);

        var lines = cartItems
            .Select(item => new OrderQuoteLineDto(
                item.ProductId,
                item.Product.Name,
                item.Quantity,
                decimal.Round(item.Product.EffectivePrice * item.Quantity, 2, MidpointRounding.AwayFromZero)))
            .ToList();
        var subtotal = lines.Sum(line => line.LineTotal);

        var now = DateTime.UtcNow;
        var userCoupons = await db.UserCoupons
            .AsNoTracking()
            .Include(coupon => coupon.CouponDefinition)
            .Where(coupon => coupon.UserId == userId && coupon.Status == "AVAILABLE")
            .ToListAsync(cancellationToken);
        var usableCouponIds = userCoupons
            .Where(coupon => IsCouponUsable(coupon, subtotal, now))
            .Select(coupon => coupon.Id.ToString())
            .ToList();

        var couponDiscount = 0m;
        if (request.CouponId.HasValue)
        {
            var coupon = userCoupons.FirstOrDefault(item => item.Id == request.CouponId.Value);
            if (coupon is null || !IsCouponUsable(coupon, subtotal, now))
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "優惠券不可使用",
                    detail: "這張優惠券不存在、不屬於目前帳號，或不適用於本次訂單金額。");
            couponDiscount = ComputeCouponDiscount(coupon.CouponDefinition, subtotal);
        }

        var pointBalance = await db.PointBalances
            .AsNoTracking()
            .Where(balance => balance.UserId == userId)
            .Select(balance => (int?)balance.Balance)
            .SingleOrDefaultAsync(cancellationToken) ?? 0;
        // integration: 點數折抵上限只看「折扣後小計」，跟 StoreOrdersController.ValidatePointsUsageAsync 用同一條規則，
        // 運費不計入上限——運費本來就不是「商品金額」，兩邊算法對不齊會讓試算跟實際下單結果不一致。
        var pointCap = Math.Max(0, (int)Math.Floor(subtotal - couponDiscount));
        pointCap = Math.Min(pointCap, pointBalance);
        var pointsUsed = Math.Clamp(request.UsePoints, 0, pointCap);

        var shippingFee = StoreCheckoutCatalog.ResolveShippingFee(shippingOption, subtotal);
        var payable = decimal.Round(subtotal - couponDiscount - pointsUsed + shippingFee, 2, MidpointRounding.AwayFromZero);
        var pointsEarned = (int)Math.Floor(payable * StoreCheckoutCatalog.PointEarnRate);

        var shippingOptionsForOrder = StoreCheckoutCatalog.ShippingOptions
            .Select(option => new ShippingOptionDto(
                option.Id,
                option.Name,
                StoreCheckoutCatalog.ResolveShippingFee(option, subtotal)))
            .ToList();

        return Ok(new OrderQuoteDto(
            lines,
            subtotal,
            0m,
            shippingFee,
            couponDiscount,
            pointsUsed,
            payable,
            pointsEarned,
            shippingOptionsForOrder,
            usableCouponIds,
            pointCap));
    }

    // integration: 這條有效性規則必須跟 StoreOrdersController.ApplyCouponAsync 保持一致，
    // 否則試算顯示「可使用」的券送出訂單時卻被拒絕，或反過來。
    private static bool IsCouponUsable(UserCoupon coupon, decimal subtotal, DateTime now)
    {
        var definition = coupon.CouponDefinition;
        return definition.IsActive
            && definition.StartAt <= now
            && definition.EndAt > now
            && coupon.ExpiresAt > now
            && subtotal >= definition.MinimumAmount
            && definition.DiscountType is "PERCENT" or "FIXED";
    }

    private static decimal ComputeCouponDiscount(CouponDefinition definition, decimal subtotal)
    {
        var discount = definition.DiscountType switch
        {
            "PERCENT" => subtotal * definition.DiscountValue / 100m,
            "FIXED" => definition.DiscountValue,
            _ => 0m
        };
        return Math.Clamp(decimal.Round(discount, 2, MidpointRounding.AwayFromZero), 0m, subtotal);
    }
}
