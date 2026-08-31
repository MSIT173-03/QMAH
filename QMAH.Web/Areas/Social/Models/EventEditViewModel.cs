using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

public sealed class EventEditViewModel
{
    [Required(ErrorMessage = "請選擇活動類型")]
    [Display(Name = "活動類型")]
    public string EventType { get; set; } = "OFFICIAL";

    [Required(ErrorMessage = "請輸入活動標題")]
    [StringLength(150, ErrorMessage = "標題不能超過 150 字")]
    [Display(Name = "活動標題")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入活動內容")]
    [Display(Name = "活動內容")]
    public string Content { get; set; } = string.Empty;

    [StringLength(200, ErrorMessage = "地點不能超過 200 字")]
    [Display(Name = "活動地點")]
    public string? Location { get; set; }

    [Display(Name = "緯度")]
    [Range(typeof(decimal), "-90", "90", ErrorMessage = "緯度必須介於 -90 到 90 之間")]
    public decimal? Latitude { get; set; }

    [Display(Name = "經度")]
    [Range(typeof(decimal), "-180", "180", ErrorMessage = "經度必須介於 -180 到 180 之間")]
    public decimal? Longitude { get; set; }

    [Required(ErrorMessage = "請輸入開始時間")]
    [Display(Name = "開始時間")]
    public DateTime StartAt { get; set; } = DateTime.Now.AddHours(1);

    [Required(ErrorMessage = "請輸入結束時間")]
    [Display(Name = "結束時間")]
    public DateTime EndAt { get; set; } = DateTime.Now.AddHours(2);

    [Display(Name = "報名截止時間")]
    public DateTime? RegistrationEndAt { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "人數上限必須大於 0")]
    [Display(Name = "人數上限")]
    public int? Capacity { get; set; }

    [StringLength(500, ErrorMessage = "審核備註不能超過 500 字")]
    [Display(Name = "審核備註")]
    public string? ReviewNote { get; set; }

    [Required(ErrorMessage = "請選擇活動貼文內容方式")]
    [RegularExpression("TEMPLATE|CUSTOM", ErrorMessage = "活動貼文內容方式無效")]
    [Display(Name = "活動貼文內容")]
    public string PostContentMode { get; set; } = "TEMPLATE";

    [StringLength(150, ErrorMessage = "活動貼文標題不能超過 150 字")]
    [Display(Name = "自訂活動貼文標題")]
    public string? PostTitle { get; set; }

    [StringLength(4000, ErrorMessage = "活動貼文內文不能超過 4000 字")]
    [Display(Name = "自訂活動貼文內文")]
    public string? PostContent { get; set; }
}
