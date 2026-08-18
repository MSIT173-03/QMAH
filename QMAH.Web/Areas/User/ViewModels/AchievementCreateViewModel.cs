using System.ComponentModel.DataAnnotations;

using Microsoft.AspNetCore.Http;

namespace QMAH.Web.Areas.User.ViewModels;

public class AchievementCreateViewModel
{
    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    public string Title { get; set; } = "";

    public string? Description { get; set; }

    // 新增成功後寫進資料庫的圖示路徑
    public string? IconPath { get; set; }

    // 新增時選擇的圖片
    public IFormFile? IconFile { get; set; }

    public string ConditionType { get; set; } = "";


    [Range(1, long.MaxValue, ErrorMessage = "門檻必須大於 0。")]
    public long ThresholdValue { get; set; } = 1;


    public string Status { get; set; } = "ACTIVE";
}