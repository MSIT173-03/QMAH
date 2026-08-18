using System;
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models
{
    public class PostCreateViewModel
    {
        [Display(Name = "看板代碼")]
        public string BoardCode { get; set; } = "GENERAL";

        [Required(ErrorMessage = "請輸入貼文標題")]
        [StringLength(100, ErrorMessage = "標題長度不能超過 100 字")]
        [Display(Name = "貼文標題")]
        public string Title { get; set; } = string.Empty;

        [Required(ErrorMessage = "請輸入貼文內容")]
        [Display(Name = "貼文內容")]
        public string Content { get; set; } = string.Empty;

        [Display(Name = "關聯文物 ID")]
        public Guid? ArtifactId { get; set; } // 👈 int? 改為 Guid?
    }
}