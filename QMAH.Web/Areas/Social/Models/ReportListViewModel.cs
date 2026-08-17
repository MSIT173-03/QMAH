using System;

namespace QMAH.Web.Areas.Social.Models;

public class ReportListViewModel
{
    public Guid Id { get; set; }
    public string TargetType { get; set; } = string.Empty; // POST, COMMENT
    public Guid TargetId { get; set; }
    public string TargetTitle { get; set; } = string.Empty; // 貼文標題
    public string TargetContent { get; set; } = string.Empty; // 貼文完整內文 / 留言內容
    public string Reason { get; set; } = string.Empty; // 檢舉類別 (如 SPAM)
    public string? Detail { get; set; } // 檢舉人填寫的詳細說明
    public string Status { get; set; } = "PENDING";
    public DateTime CreatedAt { get; set; }
}