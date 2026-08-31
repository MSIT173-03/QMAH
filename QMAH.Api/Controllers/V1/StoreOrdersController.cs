using System.Data;

using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/store/orders")]
public sealed class StoreOrdersController(QmahDbContext db) : ApiControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrderDto>> CreateOrder(
        CreateStoreOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var groupedItems = request.Items
            .Where(item => item.ProductId != Guid.Empty)
            .GroupBy(item => item.ProductId)
            .Select(group => new { ProductId = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToList();
        if (groupedItems.Count == 0 || groupedItems.Any(item => item.Quantity is < 1 or > 99))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "訂單明細無效", detail: "請提供至少一件商品，每件數量必須介於 1 到 99。");

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var productIds = groupedItems.Select(item => item.ProductId).ToArray();
        var products = await db.Products
            .Where(product => productIds.Contains(product.Id))
            .ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != productIds.Length)
            return MissingResource("找不到商品", "訂單中有商品不存在或已下架。");
        foreach (var item in groupedItems)
        {
            var product = products[item.ProductId];
            if (!product.IsActive)
                return InvalidWorkflow("商品目前未上架", $"商品「{product.Name}」目前無法購買。");
            if (product.Stock < item.Quantity)
                return InvalidWorkflow("商品庫存不足", $"商品「{product.Name}」目前庫存不足。");
        }

        var subtotal = groupedItems.Sum(item => products[item.ProductId].Price * item.Quantity);
        var discountAmount = 0m;
        UserCoupon? userCoupon = null;
        if (request.UserCouponId.HasValue)
        {
            userCoupon = await db.UserCoupons
                .Include(coupon => coupon.CouponDefinition)
                .SingleOrDefaultAsync(coupon => coupon.Id == request.UserCouponId.Value
                    && coupon.UserId == userId,
                    cancellationToken);
            if (userCoupon is null)
                return MissingResource("找不到優惠券", "這張優惠券不存在或不屬於目前帳號。");
            var definition = userCoupon.CouponDefinition;
            var now = DateTime.UtcNow;
            if (userCoupon.Status != "AVAILABLE"
                || !definition.IsActive
                || definition.StartAt > now
                || definition.EndAt < now)
            {
                return InvalidWorkflow("優惠券不可使用", "優惠券可能已使用、過期或尚未開始。");
            }
            if (subtotal < definition.MinimumAmount)
                return InvalidWorkflow("未達優惠券門檻", $"訂單小計至少需要 {definition.MinimumAmount:0.##} 元。");

            discountAmount = definition.DiscountType == "PERCENT"
                ? subtotal * definition.DiscountValue / 100m
                : definition.DiscountType == "FIXED"
                    ? definition.DiscountValue
                    : 0m;
            discountAmount = Math.Clamp(
                decimal.Round(discountAmount, 2, MidpointRounding.AwayFromZero),
                0m,
                subtotal);
        }

        if (request.PointsUsed > subtotal - discountAmount)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "點數折抵超過訂單金額", detail: "PointsUsed 不可超過折扣後的小計。");
        if (request.PointsUsed > 0)
        {
            var balance = await db.PointBalances
                .SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);
            if (balance is null || balance.Balance < request.PointsUsed)
                return InvalidWorkflow("點數不足", "目前點數餘額不足以折抵這筆訂單。");
        }

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

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            MerchantTradeNo = $"QMAH-{DateTime.UtcNow:yyyyMMddHHmmss}-{order.Id:N}"[..28],
            Amount = totalAmount,
            Status = "PENDING",
            PaymentType = "Credit_CreditCard",
            CreatedAt = order.CreatedAt
        };
        order.Payment = payment;
        db.StoreOrders.Add(order);
        db.Payments.Add(payment);

        if (userCoupon is not null)
        {
            userCoupon.Status = "USED";
            userCoupon.UsedAt = order.CreatedAt;
        }
        if (request.PointsUsed > 0)
        {
            var balance = await db.PointBalances.SingleAsync(item => item.UserId == userId, cancellationToken);
            balance.Balance -= request.PointsUsed;
            balance.UpdatedAt = order.CreatedAt;
            db.PointTransactions.Add(new PointTransaction
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Amount = -request.PointsUsed,
                Reason = "ORDER_REDEEM",
                ReferenceType = "ORDER",
                ReferenceId = order.Id,
                CreatedAt = order.CreatedAt
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Created(
            $"/api/v1/me/orders/{order.Id}",
            ToOrderDto(order));
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
        if (order.Payment is not null && order.Payment.Status is ("PENDING" or "PAID"))
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
