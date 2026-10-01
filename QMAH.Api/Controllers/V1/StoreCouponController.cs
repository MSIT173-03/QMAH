using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 折價券商店：列出目前可用點數兌換的折價券定義，並讓登入會員以點數兌換。
/// 列表只讀取定義，和商品目錄一樣不需登入；兌換屬於會員資產操作，需要登入。
/// 「哪些券可兌換」與兌換規則都集中在 EconomyService，列表與兌換因此永遠採用同一套判斷。
/// </summary>
[Route("api/v1/store/coupons")]
public sealed class StoreCouponController(QmahDbContext db, EconomyService economyService) : ApiControllerBase
{
    /// <summary>取得目前可兌換的折價券：啟用中、在活動期間內，並且有設定兌換點數，依所需點數由低到高排序。</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreCouponDto>>> GetCoupons(
        CancellationToken cancellationToken = default)
    {
        var options = await economyService.GetPointCouponOptionsAsync(cancellationToken);
        return Ok(options
            .Select(option => new StoreCouponDto(
                option.Id,
                option.Name,
                option.DiscountType,
                option.DiscountValue,
                option.MinimumAmount,
                option.PointCost,
                option.ValidityDays,
                option.EndAt))
            .ToList());
    }

    /// <summary>
    /// 以點數兌換一張折價券。檢查點數是否足夠、扣除 store.PointBalances、寫入 store.UserCoupons
    /// 與點數流水都在 EconomyService.RedeemPointCouponAsync 的同一個交易內完成，
    /// 這裡只負責身分與回應格式，與 POST /me/coupons/redeem 共用同一套規則。
    /// </summary>
    [Authorize]
    [HttpPost("{couponDefinitionId:guid}/redeem")]
    public async Task<ActionResult<StoreCouponRedeemResultDto>> Redeem(
        Guid couponDefinitionId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await economyService.RedeemPointCouponAsync(userId, couponDefinitionId, cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);

        var coupon = result.Value!;
        var remainingPoints = await db.PointBalances
            .AsNoTracking()
            .Where(balance => balance.UserId == userId)
            .Select(balance => balance.Balance)
            .SingleOrDefaultAsync(cancellationToken);

        return Ok(new StoreCouponRedeemResultDto(
            coupon.Id,
            coupon.Name,
            coupon.PointCost ?? 0,
            remainingPoints,
            coupon.ExpiresAt));
    }
}
