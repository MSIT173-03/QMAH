using QMAH.Api.Infrastructure.Payments;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

/// <summary>StoreOrdersController 與 MeController 共用的訂單 DTO 轉換。</summary>
internal static class StoreOrderMapping
{
    /// <summary>
    /// 讀取訂單不會產生綠界表單；只有下單與「前往付款」端點新增付款嘗試後才把表單傳進來，
    /// 避免每次讀取都產生新編號、重算簽章，卻沒有記錄可供 callback 反查。
    /// </summary>
    public static OrderDto ToOrderDto(StoreOrder order, EcpayCheckoutFormDto? ecpayCheckout = null) => new(
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
        order.Payment?.PaymentType,
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
        ecpayCheckout);
}
