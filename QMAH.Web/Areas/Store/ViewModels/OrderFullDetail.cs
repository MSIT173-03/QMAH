using System.ComponentModel.DataAnnotations;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderFullDetail(StoreOrder order, string username, List<OrderItemSimplefyData> list)
{
    [Display(Name = "訂單編號")]
    public Guid Id { get; } = order.Id;
    [Display(Name = "下訂會員編號")]
    public Guid UserId { get; } = order.UserId;
    [Display(Name = "下訂會員名稱")]
    public string UserName { get; } = username;
    [Display(Name = "狀態")]
    public string Status { get; } = order.Status;
    [Display(Name = "商品數量")]
    public int ItemsCount { get; } = list.Sum(v => v.Amount);
    [Display(Name = "商品小計")]
    public decimal ItemsTotal { get; } = order.Subtotal;
    [Display(Name = "折扣金額")]
    public decimal DiscountAmount { get; } = order.DiscountAmount;
    [Display(Name = "點數消耗")]
    public decimal PointUsed { get; } = order.PointsUsed;
    [Display(Name = "配送方式")]
    public string ShippingMethod { get; } = order.ShippingMethod;
    [Display(Name = "運費")]
    public decimal ShippingFee { get; } = order.ShippingFee;
    [Display(Name = "總計")]
    public decimal Total { get; } = order.TotalAmount;
    [Display(Name = "建立時間")]
    public DateTime CreateAt { get; } = order.CreatedAt;
    [Display(Name = "付款時間")]
    public DateTime? PaidAt { get; } = order.PaidAt;
    [Display(Name = "取消時間")]
    public DateTime? CancelledAt { get; } = order.CancelledAt;
    [Display(Name = "付款方式")]
    public string? PaymentType { get; } = order.Payment?.PaymentType;
    [Display(Name = "付款狀態")]
    public string? PaymentStatus { get; } = order.Payment?.Status;
    [Display(Name = "商店交易編號")]
    public string? MerchantTradeNo { get; } = order.Payment?.MerchantTradeNo;
    [Display(Name = "付款金額")]
    public decimal? PaymentAmount { get; } = order.Payment?.Amount;
    [Display(Name = "綠界交易編號")]
    public string? EcpayTradeNo { get; } = order.Payment?.EcpayTradeNo;
    [Display(Name = "綠界回傳代碼")]
    public int? RtnCode { get; } = order.Payment?.RtnCode;
    [Display(Name = "綠界回傳訊息")]
    public string? RtnMsg { get; } = order.Payment?.RtnMsg;
    [Display(Name = "金流回呼時間")]
    public DateTime? CallbackReceivedAt { get; } = order.Payment?.CallbackReceivedAt;
    [Display(Name = "付款紀錄建立時間")]
    public DateTime? PaymentCreatedAt { get; } = order.Payment?.CreatedAt;
    public bool HasPayment { get; } = order.Payment is not null;
    public bool CanEditShipping { get; } = order.Status == "PENDING_PAYMENT"
        && order.Payment is { Status: "PENDING", PaymentType: "COD" };

    public List<OrderItemSimplefyData> ItemList { get; set; } = list;
}
