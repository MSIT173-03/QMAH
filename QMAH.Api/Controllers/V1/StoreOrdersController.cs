using System.Data;
using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using System.Text;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Api.Infrastructure.Payments;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/store/orders")]
public sealed class StoreOrdersController(QmahDbContext db, IEcpayCheckoutNotifier ecpayNotifier) : ApiControllerBase
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

        var shippingOption = StoreCheckoutCatalog.FindShippingOption(request.ShippingOptionId);
        if (shippingOption is null)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "配送方式無效", detail: "請選擇有效的配送方式。");
        var paymentOption = StoreCheckoutCatalog.FindPaymentOption(request.PaymentOptionId);
        if (paymentOption is null)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "付款方式無效", detail: "請選擇有效的付款方式。");

        var operationId = Guid.NewGuid();
        // integration: 編號不在 execution strategy 外額外查資料庫，避免資料庫短暫故障繞過
        // 訂單完整交易的 retry；同一 operation ID 產生穩定編號，也保留既有可讀格式。
        var operationOrderNo = BuildOperationOrderNo(operationId);
        var idempotencyMerchantTradeNo = BuildIdempotencyMerchantTradeNo(userId, request.IdempotencyKey);

        // integration: SQL retry 必須包住完整訂單流程，而不是只重試某一次查詢；
        // 否則庫存、優惠券、點數與訂單可能只完成其中一部分。每次重試先清掉上一輪追蹤狀態，
        // 再用 Serializable 重新讀取同一批商品，維持庫存與資產的一致性。
        // 是否為「這次呼叫真的新建立」的訂單；idempotent 重送找回舊訂單時不重複通知綠界。
        StoreOrder? newlyCreatedOrder = null;
        var strategy = db.Database.CreateExecutionStrategy();
        var result = await strategy.ExecuteAsync(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                retryToken);

            // integration: commit 已成功但 response 遺失時，execution strategy 會再次進入 delegate；
            // 先用 client operation key（或本次固定 operationId）找回已建立訂單，避免第二次扣庫存／點數。
            var existingOrder = await db.StoreOrders
                .Include(item => item.OrderDetails)
                .Include(item => item.Payment)
                .SingleOrDefaultAsync(item => item.UserId == userId
                    && (item.Id == operationId
                        || (idempotencyMerchantTradeNo != null
                            && item.Payment != null
                            && item.Payment.MerchantTradeNo == idempotencyMerchantTradeNo)),
                    retryToken);
            if (existingOrder is not null)
            {
                await transaction.CommitAsync(retryToken);
                return Created(
                    $"/api/v1/me/orders/{existingOrder.Id}",
                    ToOrderDto(existingOrder));
            }

            var (products, productError) = await LoadAndValidateProductsAsync(groupedItems, retryToken);
            if (productError is not null)
                return productError;

            var subtotal = groupedItems.Sum(item => products[item.ProductId].EffectivePrice * item.Quantity);

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

            var order = BuildOrder(
                request,
                userId,
                groupedItems,
                products,
                subtotal,
                discountAmount,
                userCoupon,
                shippingOption,
                paymentOption,
                operationId,
                operationOrderNo,
                idempotencyMerchantTradeNo);

            db.StoreOrders.Add(order);
            // integration: 目前 API 只建立「待付款」訂單與付款紀錄，尚未綁定第三方付款 callback；
            // 商城負責人上線前必須用實際付款／取消／逾時情境確認這個狀態機，再接續付款與出貨流程。
            db.Payments.Add(order.Payment!);
            ApplyCouponRedemption(userCoupon, order.CreatedAt);
            await ApplyPointsRedemptionAsync(userId, request.PointsUsed, order, retryToken);
            await RemoveOrderedCartItemsAsync(userId, groupedItems, retryToken);

            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            newlyCreatedOrder = order;

            return Created(
                $"/api/v1/me/orders/{order.Id}",
                ToOrderDto(order));
        }, cancellationToken);

        // integration: 通知綠界放在交易 commit 之後才做，不佔用資料庫交易的時間；
        // 只針對這次真的新建立的訂單通知，idempotent 重送不重複通知。
        // BuildRequestForOrder 只有信用卡付款的訂單才會回傳非 null，其餘付款方式不通知。
        if (newlyCreatedOrder is not null)
        {
            var ecpayRequest = EcpayCheckoutFormBuilder.BuildRequestForOrder(newlyCreatedOrder);
            if (ecpayRequest is not null)
                await ecpayNotifier.NotifyAsync(ecpayRequest, cancellationToken);
        }

        return result;
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

    private StoreOrder BuildOrder(
        CreateStoreOrderRequest request,
        Guid userId,
        List<GroupedOrderItem> groupedItems,
        Dictionary<Guid, Product> products,
        decimal subtotal,
        decimal discountAmount,
        UserCoupon? userCoupon,
        StoreCheckoutCatalog.ShippingOptionDef shippingOption,
        StoreCheckoutCatalog.PaymentOptionDef paymentOption,
        Guid orderId,
        string orderNo,
        string? idempotencyMerchantTradeNo)
    {
        // integration: 運費一律由後端依免運門檻重新換算，不採用前端送來的金額，避免被竄改。
        var shippingFee = StoreCheckoutCatalog.ResolveShippingFee(shippingOption, subtotal);
        // integration: 訂單明細保存商品名稱與單價快照，避免商品後續改名／調價造成歷史訂單變動。
        var totalAmount = decimal.Round(
            subtotal - discountAmount - request.PointsUsed + shippingFee,
            2,
            MidpointRounding.AwayFromZero);
        var order = new StoreOrder
        {
            Id = orderId,
            OrderNo = orderNo,
            UserId = userId,
            UserCouponId = userCoupon?.Id,
            Status = "PENDING_PAYMENT",
            Subtotal = subtotal,
            DiscountAmount = discountAmount,
            PointsUsed = request.PointsUsed,
            ShippingMethod = shippingOption.Id,
            ShippingFee = shippingFee,
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
                UnitPrice = product.EffectivePrice,
                Quantity = item.Quantity,
                LineTotal = decimal.Round(product.EffectivePrice * item.Quantity, 2, MidpointRounding.AwayFromZero)
            });
        }

        order.Payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            MerchantTradeNo = idempotencyMerchantTradeNo
                ?? $"QMAH-{order.CreatedAt:yyyyMMddHHmmss}-{order.Id:N}"[..28],
            Amount = totalAmount,
            Status = "PENDING",
            PaymentType = paymentOption.Id,
            CreatedAt = order.CreatedAt
        };

        return order;
    }

    private static string? BuildIdempotencyMerchantTradeNo(Guid userId, string? idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return null;

        // 既有 Payments.MerchantTradeNo 已有唯一索引；以會員與 key 雜湊映射到既有欄位，
        // 不新增資料表或 migration，讓安全重送沿用目前資料庫契約。
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{userId:N}:{idempotencyKey.Trim()}"));
        return $"QMAH-{Convert.ToHexString(bytes)[..25]}";
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

    /// <summary>
    /// 從會員購物車移除已下單的商品；與訂單在同一筆交易中提交，
    /// 避免訂單成立但購物車仍保留商品，讓會員重複下單。未下單的購物車商品維持不變。
    /// </summary>
    private async Task RemoveOrderedCartItemsAsync(
        Guid userId,
        List<GroupedOrderItem> items,
        CancellationToken cancellationToken)
    {
        var productIds = items.Select(item => item.ProductId).ToArray();
        var cartItems = await db.CartItems
            .Where(item => item.UserId == userId && productIds.Contains(item.ProductId))
            .ToListAsync(cancellationToken);
        db.CartItems.RemoveRange(cartItems);
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
            // integration: 目前沒有第三方退款 callback；PAID 訂單不可由取消 API 假裝完成退款，
            // 只允許尚未付款的訂單進入既有回補流程，避免外部金流與資料庫狀態分裂。
            if (order.Status != "PENDING_PAYMENT")
                return InvalidWorkflow("訂單目前不可取消", "已付款、出貨或完成後的訂單請交由退款／客服流程處理。");

            // integration: 取消必須在同一交易中回補庫存、優惠券與點數，避免只回復部分資產。
            var now = DateTime.UtcNow;
            order.Status = "CANCELLED";
            order.CancelledAt = now;
            if (order.Payment is not null && order.Payment.Status == "PENDING")
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

    private static string BuildOperationOrderNo(Guid operationId)
    {
        // operationId 已由 Guid 提供唯一性；固定取值讓 commit 結果不明時重試不會再查詢或改寫編號。
        return $"QMAH-{DateTime.UtcNow:yyyyMMddHHmmss}-{operationId:N}"[..28];
    }

    private static OrderDto ToOrderDto(StoreOrder order) => new(
        order.Id,
        order.OrderNo,
        order.Status,
        order.Subtotal,
        order.DiscountAmount,
        order.PointsUsed,
        order.ShippingFee,
        order.TotalAmount,
        (int)Math.Floor(order.TotalAmount * StoreCheckoutCatalog.PointEarnRate),
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
            .ToList(),
        BuildEcpayCheckoutForm(order));

    private static EcpayCheckoutFormDto? BuildEcpayCheckoutForm(StoreOrder order)
    {
        var request = EcpayCheckoutFormBuilder.BuildRequestForOrder(order);
        return request is null ? null : EcpayCheckoutFormBuilder.Build(request);
    }
}
