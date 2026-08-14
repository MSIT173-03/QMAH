using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderSimplefyListItem
{
    [Display(Name = "訂單編號")]
    public required Guid Id { get; set; }
    [Display(Name = "下訂會員名稱")]
    public required string UserName { get; set; }
    [Display(Name = "狀態")]
    public required string Status { get; set; }
    [Display(Name = "商品數量")]
    public required int ItemsCount { get; set; }
    [Display(Name = "商品小計")]
    public required decimal ItemsTotal { get; set; }
    [Display(Name = "折扣金額")]
    public required decimal DiscountAmount { get; set; }
    [Display(Name = "點數消耗")]
    public required decimal PointUsed { get; set; }
    [Display(Name = "總計")]
    public required decimal Total { get; set; }
    [Display(Name = "建立時間")]
    public required DateTime CreateAt { get; set; }
    [Display(Name = "付款時間")]
    public DateTime? PaidAt { get; set; }
    [Display(Name = "取消時間")]
    public DateTime? CancelledAt { get; set; }
}
