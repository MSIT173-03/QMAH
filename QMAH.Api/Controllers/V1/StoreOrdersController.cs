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
    // integration: Store 分支原本把訂單流程拆到一半，留下兩套互相重疊的實作。
    // 目前集中成「輸入整理 → 商品／庫存檢查 → 折扣與點數檢查 → 建立訂單快照」四段，
    // 但仍維持既有 API 路徑、狀態名稱與資料表契約，方便商城負責人後續接付款流程。
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

        // integration: SQL retry 必須包住完整訂單流程，而不是只重試某一次查詢；
        // 否則庫存、優惠券、點數與訂單可能只完成其中一部分。每次重試先清掉上一輪追蹤狀態，
        // 再用 Serializable 重新讀取同一批商品，維持庫存與資產的一致性。
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                retryToken);

            var (products, productError) = await LoadAndValidateProductsAsync(groupedItems, retryToken);
            if (productError is not null)
                return productError;

            var subtotal = groupedItems.Sum(item => products[item.ProductId].Price * item.Quantity);

            var (userCoupon, discountAmount, couponError) = await ApplyCouponAsync(
                request.UserCouponId,
                userId,
                subtotal,
                retryToken);
            if (couponError is not null)
                return couponError;

            var pointsError = await ValidatePointsUsageAsync(
                request.PointsUsed,
                userId,
                subtotal,
                discountAmount,
                retryToken);
            if (pointsError is not null)
                return pointsError;

            var order = await BuildOrderAsync(
                request,
                userId,
                groupedItems,
                products,
                subtotal,
                discountAmount,
                userCoupon,
                retryToken);

            db.StoreOrders.Add(order);
            // integration: 目前 API 只建立「待付款」訂單與付款紀錄，尚未綁定第三方付款 callback；
            // 商城負責人上線前必須用實際付款／取消／逾時情境確認這個狀態機，再接續付款與出貨流程。
            db.Payments.Add(order.Payment!);
            ApplyCouponRedemption(userCoupon, order.CreatedAt);
            await ApplyPointsRedemptionAsync(userId, request.PointsUsed, order, retryToken);

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);

            return Created(
                $"/api/v1/me/orders/{order.Id}",
                ToOrderDto(order));
        }, cancellationToken);
    }

    /// <summary>
    /// 整理並檢查訂單商品可行性。
    /// </summary>
    /// <param name="items">前端送出的原始訂單明細。</param>
    /// <param name="grouped">依商品編號合併後的明細；相同商品不重複扣庫存。</param>
    /// <param name="err">輸入不合法時回傳的 ProblemDetails 結果。</param>
    /// <returns>輸入可繼續處理時回傳 true。</returns>
    private bool TryGroupOrderItems(
        List<CreateOrderItemRequest> items,
        [NotNullWhen(true)] out List<GroupedOrderItem>? grouped,
        [NotNullWhen(false)] out ActionResult? err)
    {
        if (items.Count == 0
            || items.Any(item => item.ProductId == Guid.Empty || item.Quantity is < 1 or > 99))
        {
            grouped = null;
            err = Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "訂單明細無效",
                detail: "請提供至少一件商品，每件商品必須有有效識別碼，數量必須介於 1 到 99。");
            return false;
        }

        var groupedItems = items
            .GroupBy(item => item.ProductId)
            .Select(group => new GroupedOrderItem(group.Key, group.Sum(item => item.Quantity)))
            .ToList();
        if (groupedItems.Any(item => item.Quantity is < 1 or > 99))
        {
            grouped = null;
            err = Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "訂單明細無效",
                detail: "同一商品合併後的數量必須介於 1 到 99。");
            return false;
        }

        grouped = groupedItems;
        err = null;
        return true;
    }

    private async Task<(Dictionary<Guid, Product> Products, ActionResult? Error)> LoadAndValidateProductsAsync(
        List<GroupedOrderItem> items,
        CancellationToken cancellationToken)
    {
        var productIds = items.Select(item => item.ProductId).ToArray();
        // integration: 商品、啟用狀態與庫存都在同一筆 Serializable transaction 中檢查，
        // 避免兩個同時結帳的請求各自看到同一份庫存後超賣。
        var products = await db.Products
            .Where(product => productIds.Contains(product.Id))
            .ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != productIds.Length)
            return (products, MissingResource("找不到商品", "訂單中有商品不存在或已下架。"));

        foreach (var item in items)
        {
            var product = products[item.ProductId];

            if (!product.IsActive)
                return (products, InvalidWorkflow("商品目前未上架", $"商品「{product.Name}」目前無法購買。"));
            if (product.Stock < item.Quantity)
                return (products, InvalidWorkflow("商品庫存不足", $"商品「{product.Name}」目前庫存不足。"));
        }

        return (products, null);
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
            .Include(coupon => coupon.CouponDefinition)
            .SingleOrDefaultAsync(coupon => coupon.Id == userCouponId.Value
                && coupon.UserId == userId
                && coupon.Status == "AVAILABLE",
                cancellationToken);
        if (userCoupon is null)
            return (null, 0m, MissingResource("找不到優惠券", "這張優惠券不存在或不屬於目前帳號。"));

        var definition = userCoupon.CouponDefinition;
        var now = DateTime.UtcNow;
        // integration: UserCoupon 自己的到期日與 CouponDefinition 的活動區間都要檢查，
        // 前者保護會員實際領到的期限，後者保護商城營運設定；只檢查其中一層會讓失效券被使用。
        if (!definition.IsActive
            || definition.StartAt > now
            || definition.EndAt <= now
            || userCoupon.ExpiresAt <= now)
            return (null, 0m, InvalidWorkflow("優惠券不可使用", "優惠券可能已使用、過期或尚未開始。"));

        if (subtotal < definition.MinimumAmount)
            return (null, 0m, InvalidWorkflow("未達優惠券門檻", $"訂單小計至少需要 {definition.MinimumAmount:0.##} 元。"));

        if (definition.DiscountType is not ("PERCENT" or "FIXED"))
            return (null, 0m, InvalidWorkflow("優惠券設定無效", "目前優惠券的折扣類型無法套用。"));

        var discountAmount = definition.DiscountType switch
        {
            "PERCENT" => subtotal * definition.DiscountValue / 100m,
            "FIXED" => definition.DiscountValue,
            _ => throw new InvalidOperationException("已通過折扣類型檢查，不應進入此分支。")
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
        // integration: 點數只折抵折扣後的小計，並在同一 transaction 內再次確認會員餘額。
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
        // integration: 訂單明細保存商品名稱與單價快照，避免商品後續改名／調價造成歷史訂單變動。
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

        // integration: 取消也使用完整 execution strategy，避免暫時性 SQL 失敗時只回補了部分資產。
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                retryToken);
            var order = await db.StoreOrders
                .Include(item => item.OrderDetails)
                    .ThenInclude(detail => detail.Product)
                .Include(item => item.Payment)
                .Include(item => item.UserCoupon)
                .SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId, retryToken);
            if (order is null)
                return MissingResource("找不到訂單", "這筆訂單不存在或不屬於目前帳號。");
            if (order.Status == "CANCELLED")
                return NoContent();
            if (order.Status is not ("PENDING_PAYMENT" or "PAID"))
                return InvalidWorkflow("訂單目前不可取消", "出貨或完成後的訂單請依既有客服流程處理。");

            // integration: 取消必須在同一交易中回補庫存、優惠券與點數，避免只回復部分資產。
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
                    .SingleOrDefaultAsync(item => item.UserId == userId, retryToken)
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

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            return NoContent();
        }, cancellationToken);
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
