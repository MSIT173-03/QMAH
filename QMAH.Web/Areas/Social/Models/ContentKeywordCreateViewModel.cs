using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

public sealed class ContentKeywordCreateViewModel
{
    [Required(ErrorMessage = "請輸入要新增的關鍵字。")]
    [StringLength(100, MinimumLength = 1)]
    public string Keyword { get; set; } = string.Empty;

    public string Action { get; set; } = "FLAG"; // BLOCK, FLAG

    [StringLength(50)]
    public string? Category { get; set; }
}
