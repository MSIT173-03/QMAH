using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class ProductSimplefyListItem
{
    [Display(Name = "編號")]
    public Guid Id { get; init; }

    [Display(Name = "名稱")]
    public string Name { get; init; } = string.Empty;

    [Display(Name = "分類")]
    public string Category { get; init; } = string.Empty;

    [Display(Name = "價格")]
    public decimal Price { get; init; }

    [Display(Name = "庫存")]
    public int Stock { get; init; }

    [Display(Name = "封面圖片網址")]
    public string ImageUrl { get; init; } = string.Empty;

    [Display(Name = "上架")]
    public bool IsActive { get; init; }
}
