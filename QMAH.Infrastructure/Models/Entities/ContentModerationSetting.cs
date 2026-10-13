namespace QMAH.Infrastructure.Models.Entities;

/// <summary>
/// 洗版防治（SimHash 重複偵測）目前生效的單一設定列，後台關鍵字管理頁可以直接調整。
/// </summary>
public partial class ContentModerationSetting
{
    public byte Id { get; set; }

    public int SimHashWindowDays { get; set; }

    public int SimHashHammingThreshold { get; set; }

    /// <summary>AI 內容審查的總開關；關閉時 API 排程整批略過，關鍵字與 SimHash 規則不受影響。</summary>
    public bool AiReviewEnabled { get; set; } = true;

    public Guid? UpdatedByUserId { get; set; }

    public DateTime UpdatedAt { get; set; }

    public byte[] RowVersion { get; set; } = null!;
}
