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
    [Display(Name = "總計")]
    public decimal Total { get; } = order.TotalAmount;
    [Display(Name = "建立時間")]
    public DateTime CreateAt { get; } = order.CreatedAt;
    [Display(Name = "付款時間")]
    public DateTime? PaidAt { get; } = order.PaidAt;
    [Display(Name = "取消時間")]
    public DateTime? CancelledAt { get; } = order.CancelledAt;

    public List<OrderItemSimplefyData> ItemList { get; set; } = list;
}
