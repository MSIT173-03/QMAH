using System;
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models
{
public sealed record PostArtifactOption(Guid Id, string ArtifactRef, string Name);

public class PostCreateViewModel
{
        [Required(ErrorMessage = "請選擇貼文類型")]
        [RegularExpression("POST|ANNOUNCEMENT", ErrorMessage = "貼文類型無效")]
        [Display(Name = "貼文類型")]
        public string PostType { get; set; } = "POST";

        [Display(Name = "貼文分類")]
        public string BoardCode { get; set; } = "GENERAL";

        [Required(ErrorMessage = "請輸入貼文標題")]
        [StringLength(100, ErrorMessage = "標題長度不能超過 100 字")]
        [Display(Name = "貼文標題")]
        public string Title { get; set; } = string.Empty;

        [Required(ErrorMessage = "請輸入貼文內容")]
        [Display(Name = "貼文內容")]
        public string Content { get; set; } = string.Empty;

        [Display(Name = "關聯文物")]
        public Guid? ArtifactId { get; set; }

        [StringLength(200, ErrorMessage = "地點不能超過 200 字")]
        [Display(Name = "貼文地點")]
        public string? LocationName { get; set; }

        [Display(Name = "緯度")]
        [Range(typeof(decimal), "-90", "90", ErrorMessage = "緯度必須介於 -90 到 90 之間")]
        public decimal? Latitude { get; set; }

        [Display(Name = "經度")]
        [Range(typeof(decimal), "-180", "180", ErrorMessage = "經度必須介於 -180 到 180 之間")]
        public decimal? Longitude { get; set; }
    }
}
