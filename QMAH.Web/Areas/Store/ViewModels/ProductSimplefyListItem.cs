using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class ProductSimplefyListItem(QMAH.Web.Models.Entities.Product product)
{
    [Display(Name = "編號")]
    public Guid Id { get; } = product.Id;
    [Display(Name = "名稱")]
    public string Name { get; } = product.Name;
    [Display(Name = "分類")]
    public string Category { get; } = product.CategoryCode;
    [Display(Name = "價格")]
    public decimal Price { get; } = product.Price;
    [Display(Name = "庫存")]
    public int Stock { get; } = product.Stock;
    [Display(Name = "封面圖片網址")]
    public string ImageUrl { get; } = product.PrimaryImagePath ?? string.Empty;
    [Display(Name = "上架")]
    public bool IsActive { get; } = product.IsActive;
}
