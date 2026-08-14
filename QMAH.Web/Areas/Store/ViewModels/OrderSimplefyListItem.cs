using System.ComponentModel.DataAnnotations;

using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderSimplefyListItem(StoreOrder order, ApplicationUser user, List<OrderDetail> items)
{
    [Display(Name = "訂單編號")]
    public Guid Id { get; set; } = order.Id;
    [Display(Name = "下訂會員編號")]
    public Guid UserId { get; set; } = user.Id;
    [Display(Name = "下訂會員名稱")]
    public string UserName { get; set; } = user.UserName ?? string.Empty;
    [Display(Name = "狀態")]
    public string Status { get; set; } = order.Status;
    [Display(Name = "商品數量")]
    public int ItemsCount { get; set; } = items.Sum(v => v.Quantity);
    [Display(Name = "商品小計")]
    public decimal ItemsTotal { get; set; } = order.Subtotal;
    [Display(Name = "折扣金額")]
    public decimal DiscountAmount { get; set; } = order.DiscountAmount;
    [Display(Name = "點數消耗")]
    public decimal PointUsed { get; set; } = order.PointsUsed;
    [Display(Name = "總計")]
    public decimal Total { get; set; } = order.TotalAmount;
    [Display(Name = "建立時間")]
    public DateTime CreateAt { get; set; } = order.CreatedAt;
    [Display(Name = "付款時間")]
    public DateTime? PaidAt { get; set; } = order.PaidAt;
    [Display(Name = "取消時間")]
    public DateTime? CancelledAt { get; set; } = order.CancelledAt;
};