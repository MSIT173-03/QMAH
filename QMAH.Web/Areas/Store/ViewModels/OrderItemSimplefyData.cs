using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class OrderItemSimplefyData
{
    [Display(Name = "訂單項目編號")]
    public required Guid Id { get; set; }

    [Display(Name = "產品編號")]
    public required Guid ProductId { get; set; }
    [Display(Name = "產品名稱")]
    public required string ProductName { get; set; }

    [Display(Name = "價格")]
    public required decimal Price { get; set; }
    [Display(Name = "購買數量")]
    public required int Amount { get; set; }
}
