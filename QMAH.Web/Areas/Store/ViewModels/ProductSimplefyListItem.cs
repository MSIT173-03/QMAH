using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Store.ViewModels;

public class ProductSimplefyListItem
{
    [Display(Name = "編號")]
    public Guid Id { get; init; }

    [Display(Name = "名稱")]
    public string Name { get; init; } = string.Empty;

    public string DisplayName => GetDisplayName(Name);

    public static string GetDisplayName(string name)
    {
        const string referenceMarker = "（故宮編號：";
        var markerIndex = name.LastIndexOf(referenceMarker, StringComparison.Ordinal);
        return markerIndex > 0 && name.EndsWith('）')
            ? name[..markerIndex]
            : name;
    }

    public int? DuplicateNumber { get; set; }

    public string DisplayLabel => DuplicateNumber is int number
        ? $"{DisplayName}（{number}號）"
        : DisplayName;

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
