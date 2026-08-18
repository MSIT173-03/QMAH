using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

public sealed class ReportEditViewModel
{
    [Required(ErrorMessage = "請選擇檢舉目標類型")]
    [Display(Name = "目標類型")]
    public string TargetType { get; set; } = "POST";

    [Required(ErrorMessage = "請輸入檢舉目標 ID")]
    [Display(Name = "目標 ID")]
    public Guid TargetId { get; set; }

    [Required(ErrorMessage = "請輸入檢舉類別")]
    [StringLength(50, ErrorMessage = "檢舉類別不能超過 50 字")]
    [Display(Name = "檢舉類別")]
    public string Reason { get; set; } = string.Empty;

    [StringLength(1000, ErrorMessage = "詳細說明不能超過 1000 字")]
    [Display(Name = "詳細說明")]
    public string? Detail { get; set; }

    [Required]
    [Display(Name = "處理狀態")]
    public string Status { get; set; } = "PENDING";

    [StringLength(1000, ErrorMessage = "處理結果不能超過 1000 字")]
    [Display(Name = "處理結果")]
    public string? Resolution { get; set; }
}
