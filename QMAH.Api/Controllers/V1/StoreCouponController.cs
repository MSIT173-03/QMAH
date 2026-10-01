using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 折價券商店：列出目前可用點數兌換的折價券定義，並讓登入會員以點數兌換。
/// 列表只讀取定義，和商品目錄一樣不需登入；兌換屬於會員資產操作，需要登入。
/// </summary>
[Route("api/v1/store/coupons")]
public sealed class StoreCouponController(QmahDbContext db, EconomyService economyService) : ApiControllerBase
{
    /// <summary>取得目前可兌換的折價券：啟用中、已開始且未結束，並且有設定兌換點數。</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreCouponDto>>> GetCoupons(
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var coupons = await db.CouponDefinitions
            .AsNoTracking()
            .Where(coupon => coupon.IsActive
                && coupon.StartAt < now
                && coupon.EndAt > now
                && coupon.PointCost != null)
            .OrderBy(coupon => coupon.PointCost)
            .ThenBy(coupon => coupon.Name)
            .Select(coupon => new StoreCouponDto(
                coupon.Id,
                coupon.Name,
                coupon.DiscountType,
                coupon.DiscountValue,
                coupon.MinimumAmount,
                coupon.PointCost!.Value,
                coupon.ValidityDays,
                coupon.EndAt))
            .ToListAsync(cancellationToken);

        return Ok(coupons);
    }

    /// <summary>
    /// 以點數兌換一張折價券。檢查點數是否足夠、扣除 store.PointBalances、寫入 store.UserCoupons
    /// 與點數流水都在 EconomyService.RedeemPointCouponAsync 的同一個交易內完成，
    /// 這裡只負責身分、轉換回應與錯誤格式，與 POST /me/coupons/redeem 共用同一套規則。
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
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => Problem(
                    statusCode: StatusCodes.Status404NotFound,
                    title: "找不到折價券",
                    detail: result.ErrorMessage),
                "CONFLICT" => Problem(
                    statusCode: StatusCodes.Status409Conflict,
                    title: "無法兌換這張折價券",
                    detail: result.ErrorMessage),
                _ => Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "請求資料無效",
                    detail: result.ErrorMessage),
            };
        }

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
