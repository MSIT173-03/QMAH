namespace QMAH.Infrastructure.Models.Entities;

/// <summary>
/// AI 內容審查排程的執行狀態（單一列）。API 的背景排程定期寫入心跳與目前使用的供應商；
/// 後台讀取後才能分辨「金鑰未設定」「排程沒有在跑」與「正常運作中」，而不是只看到待複審 0。
/// </summary>
public partial class AiReviewRuntimeStatus
{
    public byte Id { get; set; }

    /// <summary>目前生效的供應商名稱；null 代表尚未設定任何 AI 金鑰，排程整批略過。</summary>
    public string? Provider { get; set; }

    /// <summary>排程最後一次回報的時間（UTC）。</summary>
    public DateTime HeartbeatAt { get; set; }
}
