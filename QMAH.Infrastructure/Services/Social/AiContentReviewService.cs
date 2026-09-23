namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// AI 內容審查的判斷結果。<see cref="Category"/>／<see cref="Score"/> 是信心最高的違規分類與分數，
/// 只有 <see cref="Flagged"/> 為 true 時才有意義；<see cref="Summary"/> 是給後台檢舉列表看的一句話說明。
/// </summary>
public sealed record AiReviewResult(bool Flagged, string? Category, double? Score, string? Summary);

/// <summary>
/// 呼叫外部 AI 內容安全服務，當作關鍵字表、SimHash 之外的第三道訊號，同時負責辨識文字裡的違規
/// 內容跟圖片裡的暴力／色情內容。介面獨立於實際供應商——目前實作（<c>OpenAiContentReviewService</c>，
/// 在 QMAH.Api 專案）串的是 OpenAI Moderation，之後要換別家服務只要換實作，呼叫端（<c>AiContentReviewWorker</c>）
/// 不用改。所有呼叫都應該在背景排程執行，不要放進發文/留言的同步 API 路徑，外部 API 的延遲與
/// 失敗風險不該卡住使用者發文，洗版當下系統壓力最大時更不該等 AI 回應。
/// </summary>
public interface IAiContentReviewService
{
    /// <summary>
    /// 是否已經設定好可以實際呼叫外部服務（例如 API Key 是否存在）。false 時
    /// <c>AiContentReviewWorker</c> 會整批跳過本次排程、不呼叫也不把內容標成已審查，
    /// 等設定補齊後自動把累積的內容補審查，避免空窗期的內容被誤判成「審查過、沒問題」。
    /// </summary>
    bool IsConfigured { get; }

    Task<AiReviewResult> ReviewTextAsync(string content, CancellationToken cancellationToken = default);

    Task<AiReviewResult> ReviewImageAsync(byte[] imageBytes, string contentType, CancellationToken cancellationToken = default);
}
