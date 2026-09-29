using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

using Microsoft.AspNetCore.Http;

namespace QMAH.Web.Areas.Social.Models
{
public sealed record PostArtifactOption(Guid Id, string ArtifactRef, string Name);

// 後台快速插入只讀取目前有效的優惠券摘要；不把資料庫實體直接暴露給 Razor，避免編輯器依賴不必要欄位。
public sealed record PostPromotionOption(
    Guid Id,
    string Name,
    string Code,
    string DiscountLabel,
    string AcquisitionLabel,
    string MinimumLabel,
    string PeriodLabel,
    string ValidityLabel);

// 編輯頁顯示既有圖片用；Url 指向後台受權限保護的讀檔 action，不直接暴露媒體目錄。
public sealed record PostMediaItem(Guid Id, string Url, string FileName);

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

        // 新增的圖片附件；實際格式與大小由 SocialPostMediaService 以檔案內容檢查，不信任副檔名。
        [Display(Name = "附加圖片")]
        public List<IFormFile> Images { get; set; } = [];

        // 編輯時勾選要移除的既有圖片（只會軟刪除屬於這篇貼文的圖片）。
        public List<Guid> RemoveMediaIds { get; set; } = [];
    }
}
