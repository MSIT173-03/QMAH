using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models
{
    /// <summary>
    /// 後台官方公告新增/編輯表單 ViewModel
    /// </summary>
    public class AnnouncementEditViewModel
    {
        public Guid? Id { get; set; }

        [Required(ErrorMessage = "請輸入公告標題")]
        [StringLength(150, ErrorMessage = "標題最多 150 字")]
        [Display(Name = "公告標題")]
        public string Title { get; set; } = string.Empty;

        [StringLength(300, ErrorMessage = "摘要最多 300 字")]
        [Display(Name = "公告摘要")]
        public string? Summary { get; set; }

        [Required(ErrorMessage = "請選擇公告分類")]
        [StringLength(30)]
        [Display(Name = "公告分類")]
        public string Category { get; set; } = "UPDATE"; // 預設系統更新

        [Required]
        [Display(Name = "發布狀態")]
        public string Status { get; set; } = "DRAFT"; // DRAFT, PUBLISHED, ARCHIVED

        [Display(Name = "預計發布時間")]
        public DateTime? PublishAt { get; set; }

        [Display(Name = "公告結束時間")]
        public DateTime? EndAt { get; set; }
    }
}