using System.Data;
using System.Diagnostics.CodeAnalysis;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/store/orders")]
public sealed class StoreOrdersController(QmahDbContext db) : ApiControllerBase
{

    private readonly record struct GroupedOrderItem(Guid ProductId, int Quantity);

    [HttpPost]
    public async Task<ActionResult<OrderDto>> CreateOrder(
        CreateStoreOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!TryGroupOrderItems(request.Items, out var groupedItems, out var emptyErr))
            return emptyErr;

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        if (!TryLoadAndValidateProducts(groupedItems, cancellationToken, out var products, out var unvalidErr))
            return unvalidErr;

        var subtotal = groupedItems.Sum(item => products[item.ProductId].Price * item.Quantity);

        var (userCoupon, discountAmount, couponError) = await ApplyCouponAsync(
            request.UserCouponId,
            userId,
            subtotal,
            cancellationToken);
        if (couponError is not null)
            return couponError;

        var pointsError = await ValidatePointsUsageAsync(
            request.PointsUsed,
            userId,
            subtotal,
            discountAmount,
            cancellationToken);
        if (pointsError is not null)
            return pointsError;

        var order = await BuildOrderAsync(
            request,
            userId,
            groupedItems!,
            products!,
            subtotal,
            discountAmount,
            userCoupon,
            cancellationToken);

        db.StoreOrders.Add(order);
        db.Payments.Add(order.Payment!);
        ApplyCouponRedemption(userCoupon, order.CreatedAt);
        await ApplyPointsRedemptionAsync(userId, request.PointsUsed, order, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Created(
            $"/api/v1/me/orders/{order.Id}",
            ToOrderDto(order));
    }

    /// <summary>
    /// 整理並檢查訂單商品可行性。
    /// </summary>
    /// <param name="items"></param>
    /// <param name="grouped"></param>
    /// <param name="err"></param>
    /// <returns></returns>
    private bool TryGroupOrderItems(
        List<CreateOrderItemRequest> items,
        [NotNullWhen(true)] out List<GroupedOrderItem>? grouped,
        [NotNullWhen(false)] out ActionResult? err)
    {
        var groupedItems = items
           .Where(item => item.ProductId != Guid.Empty)
           .GroupBy(item => item.ProductId)
           .Select(group => new GroupedOrderItem(group.Key, group.Sum(item => item.Quantity)))
           .ToList();
        if (groupedItems.Count == 0 || groupedItems.Any(item => item.Quantity < 0))
        {
            grouped = null;
            err = Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "訂單明細無效",
                detail: "請提供至少一件商品，每件數量必須大於零。");
            return false;
        }

        grouped = groupedItems;
        err = null;
        return true;
    }

    private bool TryLoadAndValidateProducts(
        List<GroupedOrderItem> items,
        CancellationToken cancellationToken,
        [NotNullWhen(true)] out Dictionary<Guid, Product>? products,
        [NotNullWhen(false)] out ActionResult? err)
    {
        products = items
            .Join(db.Products, i => i.ProductId, p => p.Id, (i, p) => p)
            .ToDictionary(v => v.Id);

        if (products.Count != items.Count)
        {
            err = MissingResource("找不到商品", "訂單中有商品不存在或已下架。");
            return false;
        }

        foreach (var item in items)
        {
            var product = products[item.ProductId];

            if (!product.IsActive)
            {
                err = InvalidWorkflow("商品目前未上架", $"商品「{product.Name}」目前無法購買。");
                return false;
            }
            if (product.Stock < item.Quantity)
            {
                err = InvalidWorkflow("商品庫存不足", $"商品「{product.Name}」目前庫存不足。");
                return false;
            }
        }

        err = null;
        return true;
    }


    private async Task<(UserCoupon? Coupon, decimal DiscountAmount, ActionResult? Error)> ApplyCouponAsync(
        Guid? userCouponId,
        Guid userId,
        decimal subtotal,
        CancellationToken cancellationToken)
    {
        if (!userCouponId.HasValue)
            return (null, 0m, null);

        var userCoupon = await db.UserCoupons
            .SingleOrDefaultAsync(coupon => coupon.Id == userCouponId.Value
                && coupon.UserId == userId
                && coupon.Status == "AVAILABLE",
                    cancellationToken);
        if (userCoupon is null)
            return (null, 0m, MissingResource("找不到優惠券", "這張優惠券不存在或不屬於目前帳號。"));

        var definition = userCoupon.CouponDefinition;
        var now = DateTime.UtcNow;
        if (!definition.IsActive
                || definition.StartAt > now
                || definition.EndAt < now)
            return (null, 0m, InvalidWorkflow("優惠券不可使用", "優惠券可能已使用、過期或尚未開始。"));

        if (subtotal <= definition.MinimumAmount)
            return (null, 0m, InvalidWorkflow("未達優惠券門檻", $"訂單小計至少需要 {definition.MinimumAmount:0.##} 元。"));

        var discountAmount = definition.DiscountType switch
        {
            "PERCENT" => subtotal * definition.DiscountValue / 100m,
            "FIXED" => definition.DiscountValue,
            _ => 0m
        };
        discountAmount = Math.Clamp(
            decimal.Round(discountAmount, 2, MidpointRounding.AwayFromZero),
            0m,
            subtotal);

        return (userCoupon, discountAmount, null);
    }

    private async Task<ActionResult?> ValidatePointsUsageAsync(
        int pointsUsed,
        Guid userId,
        decimal subtotal,
        decimal discountAmount,
        CancellationToken cancellationToken)
    {
        if (pointsUsed > subtotal - discountAmount)
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "點數折抵超過訂單金額",
                detail: "PointsUsed 不可超過折扣後的小計。");
        if (pointsUsed > 0)
        {
            var balance = await db.PointBalances
                .SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);

            if (balance is null || balance.Balance < pointsUsed)
                return InvalidWorkflow("點數不足", "目前點數餘額不足以折抵這筆訂單。");
        }

        return null;
    }

    private async Task<StoreOrder> BuildOrderAsync(
        CreateStoreOrderRequest request,
        Guid userId,
        List<GroupedOrderItem> groupedItems,
        Dictionary<Guid, Product> products,
        decimal subtotal,
        decimal discountAmount,
        UserCoupon? userCoupon,
        CancellationToken cancellationToken)
    {
        var totalAmount = decimal.Round(
            subtotal - discountAmount - request.PointsUsed,
            2,
            MidpointRounding.AwayFromZero);
        var order = new StoreOrder
        {
            Id = Guid.NewGuid(),
            OrderNo = await GenerateOrderNoAsync(cancellationToken),
            UserId = userId,
            UserCouponId = userCoupon?.Id,
            Status = "PENDING_PAYMENT",
            Subtotal = subtotal,
            DiscountAmount = discountAmount,
            PointsUsed = request.PointsUsed,
            TotalAmount = totalAmount,
            RecipientName = request.RecipientName.Trim(),
            RecipientPhone = request.RecipientPhone.Trim(),
            ShippingPostalCode = request.ShippingPostalCode.Trim(),
            ShippingCity = request.ShippingCity.Trim(),
            ShippingDistrict = request.ShippingDistrict.Trim(),
            ShippingAddressLine = request.ShippingAddressLine.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        foreach (var item in groupedItems)
        {
            var product = products[item.ProductId];
            product.Stock -= item.Quantity;
            product.UpdatedAt = DateTime.UtcNow;
            order.OrderDetails.Add(new OrderDetail
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductId = product.Id,
                ProductNameSnapshot = product.Name,
                UnitPrice = product.Price,
                Quantity = item.Quantity,
                LineTotal = decimal.Round(product.Price * item.Quantity, 2, MidpointRounding.AwayFromZero)
            });
        }

        order.Payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            MerchantTradeNo = $"QMAH-{DateTime.UtcNow:yyyyMMddHHmmss}-{order.Id:N}"[..28],
            Amount = totalAmount,
            Status = "PENDING",
            PaymentType = "Credit_CreditCard",
            CreatedAt = order.CreatedAt
        };

        return order;
    }

    private static void ApplyCouponRedemption(UserCoupon? userCoupon, DateTime redeemedAt)
    {
        if (userCoupon is null)
            return;

        userCoupon.Status = "USED";
        userCoupon.UsedAt = redeemedAt;
    }

    private async Task ApplyPointsRedemptionAsync(
        Guid userId,
        int pointsUsed,
        StoreOrder order,
        CancellationToken cancellationToken)
    {
        if (pointsUsed <= 0)
            return;

        var balance = await db.PointBalances.SingleAsync(item => item.UserId == userId, cancellationToken);
        balance.Balance -= pointsUsed;
        balance.UpdatedAt = order.CreatedAt;
        db.PointTransactions.Add(new PointTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = -pointsUsed,
            Reason = "ORDER_REDEEM",
            ReferenceType = "ORDER",
            ReferenceId = order.Id,
            CreatedAt = order.CreatedAt
        });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult> CancelOrder(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var order = await db.StoreOrders
            .Include(item => item.OrderDetails)
                .ThenInclude(detail => detail.Product)
            .Include(item => item.Payment)
            .Include(item => item.UserCoupon)
            .SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (order is null)
            return MissingResource("找不到訂單", "這筆訂單不存在或不屬於目前帳號。");
        if (order.Status == "CANCELLED")
            return NoContent();
        if (order.Status is not ("PENDING_PAYMENT" or "PAID"))
            return InvalidWorkflow("訂單目前不可取消", "出貨或完成後的訂單請依既有客服流程處理。");

        var now = DateTime.UtcNow;
        order.Status = "CANCELLED";
        order.CancelledAt = now;
        if (order.Payment is not null && order.Payment.Status is "PENDING" or "PAID")
        {
            order.Payment.Status = "CANCELLED";
            order.Payment.CallbackReceivedAt = now;
        }
        foreach (var detail in order.OrderDetails)
        {
            detail.Product.Stock += detail.Quantity;
            detail.Product.UpdatedAt = now;
        }
        if (order.UserCoupon is not null && order.UserCoupon.Status == "USED")
        {
            order.UserCoupon.Status = "AVAILABLE";
            order.UserCoupon.UsedAt = null;
        }
        if (order.PointsUsed > 0)
        {
            var balance = await db.PointBalances
                .SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken)
                ?? throw new InvalidOperationException("訂單點數退款時找不到會員點數帳戶。");
            balance.Balance += order.PointsUsed;
            balance.UpdatedAt = now;
            db.PointTransactions.Add(new PointTransaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = order.PointsUsed,
                Reason = "ORDER_CANCEL_REFUND",
                ReferenceType = "ORDER",
                ReferenceId = order.Id,
                CreatedAt = now
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    private async Task<string> GenerateOrderNoAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var orderNo = $"QMAH-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..28];
            if (!await db.StoreOrders.AnyAsync(order => order.OrderNo == orderNo, cancellationToken))
                return orderNo;
        }

        throw new InvalidOperationException("目前無法產生唯一訂單編號，請稍後再試。");
    }

    private static OrderDto ToOrderDto(StoreOrder order) => new(
        order.Id,
        order.OrderNo,
        order.Status,
        order.Subtotal,
        order.DiscountAmount,
        order.PointsUsed,
        order.TotalAmount,
        order.RecipientName,
        order.RecipientPhone,
        order.ShippingPostalCode,
        order.ShippingCity,
        order.ShippingDistrict,
        order.ShippingAddressLine,
        order.Payment?.Status,
        order.CreatedAt,
        order.PaidAt,
        order.CancelledAt,
        order.OrderDetails
            .OrderBy(detail => detail.Id)
            .Select(detail => new OrderLineDto(
                detail.ProductId,
                detail.ProductNameSnapshot,
                detail.UnitPrice,
                detail.Quantity,
                detail.LineTotal))
            .ToList());
}
