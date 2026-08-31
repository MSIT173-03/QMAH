using System.ComponentModel.DataAnnotations;

using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderSimplefyListItem(StoreOrder order, ApplicationUser user, List<OrderDetail> items)
{
    [Display(Name = "資料識別碼")]
    public Guid Id { get; } = order.Id;
    [Display(Name = "訂單編號")]
    public string OrderNo { get; } = order.OrderNo;
    [Display(Name = "下訂會員編號")]
    public Guid UserId { get; } = user.Id;
    [Display(Name = "下訂會員名稱")]
    public string UserName { get; } = user.UserName ?? string.Empty;
    [Display(Name = "狀態")]
    public string Status { get; } = order.Status;
    [Display(Name = "商品數量")]
    public int ItemsCount { get; } = items.Sum(v => v.Quantity);
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
};
