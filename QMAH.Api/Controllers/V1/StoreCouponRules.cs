using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

/// <summary>優惠券不可使用的原因；None 代表可以使用。</summary>
internal enum CouponRejection { None, NotInEffect, BelowMinimum, UnsupportedType }

/// <summary>
/// 優惠券「能不能用」與「折多少」的唯一定義，試算（StoreCheckoutController）與下單（StoreOrdersController）共用，
/// 試算顯示可用的券下單時一定可用。純函式，不讀寫資料庫；傳入的 UserCoupon 需已載入 CouponDefinition。
/// </summary>
internal static class StoreCouponRules
{
    /// <summary>判斷券是否可用，可用時一併算出折抵金額（已限制在 0 到小計之間）。</summary>
    public static (CouponRejection Rejection, decimal Discount) Evaluate(
        UserCoupon coupon,
        decimal subtotal,
        DateTime now)
    {
        var definition = coupon.CouponDefinition;
        // UserCoupon 自己的到期日與 CouponDefinition 的活動區間都要檢查，
        // 前者保護會員實際領到的期限，後者保護商城營運設定；只檢查其中一層會讓失效券被使用。
        if (!definition.IsActive
            || definition.StartAt > now
            || definition.EndAt <= now
            || coupon.ExpiresAt <= now)
            return (CouponRejection.NotInEffect, 0m);

        if (subtotal < definition.MinimumAmount)
            return (CouponRejection.BelowMinimum, 0m);

        decimal? discount = definition.DiscountType switch
        {
            "PERCENT" => subtotal * definition.DiscountValue / 100m,
            "FIXED" => definition.DiscountValue,
            _ => null
        };
        if (discount is null)
            return (CouponRejection.UnsupportedType, 0m);

        return (
            CouponRejection.None,
            Math.Clamp(decimal.Round(discount.Value, 2, MidpointRounding.AwayFromZero), 0m, subtotal));
    }
}
