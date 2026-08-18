using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public sealed class ProductEditViewModel
{
    public Guid Id { get; set; }

    [Display(Name = "關聯文物")]
    public Guid? ArtifactId { get; set; }

    [Required(ErrorMessage = "請輸入商品分類")]
    [StringLength(30)]
    [Display(Name = "商品分類")]
    public string CategoryCode { get; set; } = string.Empty;

    [StringLength(100)]
    [Display(Name = "外部編號")]
    public string? ExternalRef { get; set; }

    [Required(ErrorMessage = "請輸入商品名稱")]
    [StringLength(200)]
    [Display(Name = "商品名稱")]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    [Display(Name = "商品描述")]
    public string? Description { get; set; }

    [StringLength(500)]
    [Display(Name = "尺寸說明")]
    public string? SizeText { get; set; }

    [Range(0, 999999999, ErrorMessage = "價格不可小於 0")]
    [Display(Name = "價格")]
    public decimal Price { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "庫存不可小於 0")]
    [Display(Name = "庫存")]
    public int Stock { get; set; }

    [StringLength(500)]
    [Display(Name = "主圖片網址")]
    public string? PrimaryImagePath { get; set; }

    [StringLength(1000)]
    [Display(Name = "來源網址")]
    public string? SourceUrl { get; set; }

    [Display(Name = "上架")]
    public bool IsActive { get; set; } = true;
}
