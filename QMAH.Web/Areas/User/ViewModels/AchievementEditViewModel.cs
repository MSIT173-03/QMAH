using System.ComponentModel.DataAnnotations;

using Microsoft.AspNetCore.Http;

namespace QMAH.Web.Areas.User.ViewModels;

public class AchievementEditViewModel
{
    public Guid Id { get; set; }

    public string Code { get; set; } = "";

    public string Name { get; set; } = "";

    public string Title { get; set; } = "";

    public string? Description { get; set; }

    // 資料庫目前儲存的圖示路徑
    public string? IconPath { get; set; }

    // 這次選擇上傳的新圖示
    public IFormFile? IconFile { get; set; }

    public string ConditionType { get; set; } = "";


    [Range(1, long.MaxValue, ErrorMessage = "門檻必須大於 0。")]
    public long ThresholdValue { get; set; }

    public string Status { get; set; } = "";

    public byte[] RowVersion { get; set; } = [];
}