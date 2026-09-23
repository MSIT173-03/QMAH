using System.Text.RegularExpressions;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// AI 內容審查採「折衷」策略：不是每篇貼文/留言都呼叫外部 AI API（成本、延遲都不小，
/// 洗版當下流量最大時更不該卡在發文路徑上），而是先用免費、即時的規則式判斷過濾掉大部分
/// 正常內容，只有「看起來可疑」的才排進 AI 複審佇列（見 <c>AiContentReviewWorker</c>）。
/// 這裡只判斷「值不值得讓 AI 看一眼」，不判斷是否真的違規——會不會抓錯全部交給 AI 本身決定。
/// 已經被關鍵字表或 SimHash 命中、送出檢舉的內容不會再進來檢查（呼叫端負責短路），
/// 避免同一篇內容重複花錢問兩次。
/// </summary>
public static class SuspiciousContentHeuristics
{
    // 連結／短網址：詐騙、廣告、釣魚內容最常見的共同特徵。
    private static readonly Regex UrlPattern = new(
        @"https?://|www\.|\b[a-z0-9-]+\.(com|net|tw|cc|xyz|top|link|shop)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // 台灣手機號碼／國際格式，常見於「加LINE」「私訊」這類招攬話術。
    private static readonly Regex PhonePattern = new(
        @"09\d{2}[-\s]?\d{3}[-\s]?\d{3}|\+?886[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}",
        RegexOptions.Compiled);

    // 引導到站外聯絡管道，是招攬詐騙/代購/色情服務常見的下一步。
    private static readonly Regex ContactAppPattern = new(
        @"line\s*id|line\.me|telegram|whatsapp|微信|wechat|ig\s*帳號|@[a-z0-9_]{4,}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // 同一個字元連續出現很多次（灌版洗版常見手法），例如「！！！！！！」「哈哈哈哈哈哈哈」。
    private static readonly Regex RepeatedCharPattern = new(@"(.)\1{5,}", RegexOptions.Compiled);

    // 內容異常長：正常閒聊貼文/留言很少寫這麼長，長文字也是 AI 判斷比較划算的地方。
    private const int LongContentThreshold = 600;

    public static bool LooksSuspicious(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return false;

        return UrlPattern.IsMatch(content)
            || PhonePattern.IsMatch(content)
            || ContactAppPattern.IsMatch(content)
            || RepeatedCharPattern.IsMatch(content)
            || content.Length >= LongContentThreshold;
    }
}
