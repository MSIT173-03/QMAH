using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Social.Models;

public sealed class ContentModerationSettingsViewModel
{
    // SimHash 比對最近幾天內的內容才算「重複」，值太大會拖慢查詢也可能誤判巧合的舊內容。
    [Range(1, 90, ErrorMessage = "比對天數請填 1～90 天。")]
    public int SimHashWindowDays { get; set; } = 7;

    // 64-bit 指紋差幾 bit 以內算「太像」，值越小越嚴格。
    [Range(0, 64, ErrorMessage = "Hamming 門檻請填 0～64 bit。")]
    public int SimHashHammingThreshold { get; set; } = 8;

    public DateTime? UpdatedAt { get; set; }
}
