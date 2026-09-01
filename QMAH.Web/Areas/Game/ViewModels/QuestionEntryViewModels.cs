using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Game.ViewModels;

public sealed class QuestionEntryIndexViewModel
{
    public string? Search { get; init; }

    public bool? IsEnabled { get; init; }

    public byte? Difficulty { get; init; }

    public string? CategoryCode { get; init; }

    public string Sort { get; init; } = "default";

    public int PageSize { get; init; } = 20;

    public required PagedResult<QuestionEntryListItemViewModel> Results { get; init; }
}

public class QuestionEntryListItemViewModel
{
    public Guid Id { get; init; }

    public required string ArtifactRef { get; init; }

    public required string ArtifactName { get; init; }

    public string? ImagePath { get; init; }

    /// <summary>
    /// 原始大圖路徑；清單與頁面本身只載入 ImagePath，避免大圖拖慢首屏。
    /// </summary>
    public string? FullImagePath { get; init; }

    public required string CategoryName { get; init; }

    public required string EraName { get; init; }

    public string? SizeText { get; init; }

    public bool IsEnabled { get; init; }

    public byte Difficulty { get; init; }

    public required string QuestionTemplateCode { get; init; }

    public DateTime UpdatedAt { get; init; }
}

public sealed class QuestionEntryDetailsViewModel : QuestionEntryListItemViewModel
{
    public DateTime CreatedAt { get; init; }
}

public sealed class QuestionEntryEditViewModel
{
    public Guid Id { get; set; }

    public Guid ArtifactId { get; set; }

    public string ArtifactRef { get; set; } = string.Empty;

    public string ArtifactName { get; set; } = string.Empty;

    public string? ImagePath { get; set; }

    [Display(Name = "是否啟用")]
    public bool IsEnabled { get; set; }

    [Display(Name = "難度")]
    [Range(1, 5, ErrorMessage = "難度必須介於 1 到 5")]
    public byte Difficulty { get; set; }

    [Display(Name = "題型範本")]
    [Required(ErrorMessage = "請選擇題型範本")]
    [StringLength(50)]
    public string QuestionTemplateCode { get; set; } = "GENERAL";
}

public sealed class QuestionEntryCreateViewModel
{
    [Display(Name = "文物")]
    [Required(ErrorMessage = "請選擇尚未建立題庫設定的文物")]
    public Guid? ArtifactId { get; set; }

    [Display(Name = "是否啟用")]
    public bool IsEnabled { get; set; } = true;

    [Display(Name = "難度")]
    [Range(1, 5, ErrorMessage = "難度必須介於 1 到 5")]
    public byte Difficulty { get; set; } = 1;

    [Display(Name = "題型範本")]
    [Required(ErrorMessage = "請選擇題型範本")]
    [StringLength(50)]
    public string QuestionTemplateCode { get; set; } = "GENERAL";
}

public sealed class QuestionEntryDeleteViewModel
{
    public Guid Id { get; init; }

    public required string ArtifactRef { get; init; }

    public required string ArtifactName { get; init; }

    public bool IsEnabled { get; init; }
}
