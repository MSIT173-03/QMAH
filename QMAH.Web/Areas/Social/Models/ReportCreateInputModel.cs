using System;
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

/// <summary>
/// 前端送出內容檢舉時的輸入模型
/// </summary>
public class ReportCreateInputModel
{
    [Required(ErrorMessage = "請指定檢舉目標類型")]
    public string TargetType { get; set; } = string.Empty;

    [Required(ErrorMessage = "請指定檢舉目標 ID")]
    public Guid TargetId { get; set; }

    [Required(ErrorMessage = "請選擇檢舉原因")]
    public string Reason { get; set; } = string.Empty;

    public string? Detail { get; set; }
}