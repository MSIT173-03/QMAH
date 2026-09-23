using System.Numerics;
using System.Text;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 用 SimHash 偵測貼文/留言是否跟最近幾天內的其他內容太相似（複製貼上洗版）。
/// 只在「新增」時檢查一次，不影響既有內容也不擋發文；分數用 64-bit 指紋比 Hamming distance，
/// 比對母體是最近幾天內所有已發布內容，實際天數與門檻由 <see cref="ContentModerationSettingsService"/>
/// 提供（後台關鍵字管理頁可調整，見 <c>social.ContentModerationSettings</c>）。
/// 呼叫端（<c>SocialController</c>）負責決定：同一人洗版 → 自動送出檢舉待審；不同人內容相似 → 目前先放行
/// （之後接關鍵字表後，同時命中關鍵字才會送出檢舉）。
/// </summary>
/// <summary>
/// 一筆比對到的重複內容：UserId 是該筆內容的作者，ContentId 是該筆內容自己的主鍵，
/// 讓呼叫端除了判斷「是不是同一人洗版」，也能回頭把「來源那一篇」一併送出檢舉（全部檢舉，不再只保留第一篇）。
/// </summary>
public readonly record struct DuplicateContentMatch(Guid UserId, Guid ContentId);

public sealed class ContentSimilarityService(QmahDbContext db, ContentModerationSettingsService settingsService)
{
    /// <summary>
    /// 用字元 bigram 算 64-bit SimHash 指紋；中文沒有天然詞界，bigram 比整詞切分穩定。
    /// 內容太短（去空白後少於 2 字）沒有足夠特徵可比對時回傳 0，呼叫端應視為「不檢查」。
    /// </summary>
    public long ComputeSimHash(string content)
    {
        var normalized = Normalize(content);
        var features = ExtractBigrams(normalized);
        if (features.Count == 0)
            return 0;

        var bitWeights = new int[64];
        foreach (var feature in features)
        {
            var hash = Fnv1a64(feature);
            for (var bit = 0; bit < 64; bit++)
            {
                if (((hash >> bit) & 1UL) != 0)
                    bitWeights[bit]++;
                else
                    bitWeights[bit]--;
            }
        }

        long fingerprint = 0;
        for (var bit = 0; bit < 64; bit++)
        {
            if (bitWeights[bit] > 0)
                fingerprint |= 1L << bit;
        }
        return fingerprint;
    }

    /// <summary>
    /// 找最近幾天內第一筆跟這個指紋太像的貼文，回傳它的作者 UserId 與自己的 PostId；呼叫端可以用來判斷
    /// 「同一人洗版」還是「不同人但內容相似」，兩種要接的後續處理不一樣；也可以用 ContentId 回頭把來源那篇
    /// 一併送出檢舉。沒有任何一筆夠像就回傳 null。
    /// </summary>
    public async Task<DuplicateContentMatch?> FindRecentDuplicatePostAsync(long simHash, CancellationToken cancellationToken = default)
    {
        if (simHash == 0)
            return null;

        var settings = await settingsService.GetAsync(cancellationToken);
        var cutoff = DateTime.UtcNow.AddDays(-settings.SimHashWindowDays);
        var candidates = await db.SocialPosts
            .Where(post => post.CreatedAt >= cutoff && post.Status == "PUBLISHED" && post.SimHash != null)
            .Select(post => new { post.Id, post.UserId, SimHash = post.SimHash!.Value })
            .ToListAsync(cancellationToken);

        // 64 bit 裡差幾 bit 以內算「太像」，門檻越小越嚴格：實測插入/刪除兩三個字或加標點符號
        // （常見的洗版規避手法）大約會讓指紋差 6~8 bit，完全不相關的內容則差 30 up；預設 8 大概是
        // 「還是同一句話被小改過」跟「純屬巧合」之間的分界，實際值可在後台關鍵字管理頁調整。
        var match = candidates
            .FirstOrDefault(candidate => HammingDistance(simHash, candidate.SimHash) <= settings.SimHashHammingThreshold);
        return match is null ? null : new DuplicateContentMatch(match.UserId, match.Id);
    }

    /// <summary>同 <see cref="FindRecentDuplicatePostAsync"/>，但比對留言。</summary>
    public async Task<DuplicateContentMatch?> FindRecentDuplicateCommentAsync(long simHash, CancellationToken cancellationToken = default)
    {
        if (simHash == 0)
            return null;

        var settings = await settingsService.GetAsync(cancellationToken);
        var cutoff = DateTime.UtcNow.AddDays(-settings.SimHashWindowDays);
        var candidates = await db.SocialComments
            .Where(comment => comment.CreatedAt >= cutoff && comment.Status == "PUBLISHED" && comment.SimHash != null)
            .Select(comment => new { comment.Id, comment.UserId, SimHash = comment.SimHash!.Value })
            .ToListAsync(cancellationToken);

        var match = candidates
            .FirstOrDefault(candidate => HammingDistance(simHash, candidate.SimHash) <= settings.SimHashHammingThreshold);
        return match is null ? null : new DuplicateContentMatch(match.UserId, match.Id);
    }

    private static int HammingDistance(long a, long b) => BitOperations.PopCount((ulong)(a ^ b));

    private static string Normalize(string content) =>
        new([.. content.Where(c => !char.IsWhiteSpace(c))]);

    private static List<string> ExtractBigrams(string text)
    {
        if (text.Length < 2)
            return text.Length == 1 ? [text] : [];

        var features = new List<string>(text.Length - 1);
        for (var i = 0; i < text.Length - 1; i++)
            features.Add(text.Substring(i, 2));
        return features;
    }

    // 用 UTF-8 位元組跑 FNV-1a，不用 string.GetHashCode()——那個每次啟動的種子不同，指紋沒辦法跨程序、跨重啟比較。
    private static ulong Fnv1a64(string feature)
    {
        const ulong offset = 14695981039346656037UL;
        const ulong prime = 1099511628211UL;

        var hash = offset;
        foreach (var b in Encoding.UTF8.GetBytes(feature))
        {
            hash ^= b;
            hash *= prime;
        }
        return hash;
    }
}
