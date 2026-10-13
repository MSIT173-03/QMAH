namespace QMAH.Infrastructure.Models.Entities;

/// <summary>
/// AI 內容審查的每一次判斷紀錄（不論是否違規），後台據此看得出審查有沒有實際在跑、審了哪些內容、結果如何。
/// 只有 API 排程寫入；呼叫失敗的內容不會寫入，會在下一輪重試。
/// </summary>
public partial class AiReviewLog
{
    public long Id { get; set; }

    public DateTime ReviewedAt { get; set; }

    /// <summary>POST（貼文）、COMMENT（留言）或 MEDIA（圖片）。</summary>
    public string TargetType { get; set; } = null!;

    public Guid TargetId { get; set; }

    public string Provider { get; set; } = null!;

    public bool Flagged { get; set; }

    /// <summary>違規且信心高到先自動隱藏。</summary>
    public bool AutoHidden { get; set; }

    public string? Category { get; set; }

    public double? Score { get; set; }

    public string? Summary { get; set; }
}
