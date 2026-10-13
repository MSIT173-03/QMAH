using System.Text.RegularExpressions;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 狂刷內容的同步判斷：同一個字連續出現十次以上，或兩到四個字的片段連續重複五次以上
/// （例如「6767676767」「哈哈哈哈哈哈哈哈哈哈」「我愛你我愛你我愛你我愛你我愛你」）。
/// 門檻刻意放寬，正常的「哈哈哈哈」「！！！」「6767」不會被擋，只擋明顯是灌版的內容。
/// 規則很便宜，可以放在發文與留言的同步路徑上，直接拒絕、不寫進資料庫。
/// </summary>
public static class ContentFloodRules
{
    private static readonly Regex SingleCharRun = new(@"(.)\1{9,}", RegexOptions.Compiled | RegexOptions.Singleline);
    private static readonly Regex ShortUnitRepeat = new(@"(.{2,4}?)\1{4,}", RegexOptions.Compiled | RegexOptions.Singleline);

    public static bool LooksLikeFlood(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return false;

        // 先去掉空白與換行，避免用空格把重複片段隔開來繞過。
        var compact = Regex.Replace(content, @"\s+", string.Empty);
        return SingleCharRun.IsMatch(compact) || ShortUnitRepeat.IsMatch(compact);
    }
}
