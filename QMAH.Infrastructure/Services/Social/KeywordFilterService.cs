using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using QMAH.Infrastructure.Data;

namespace QMAH.Infrastructure.Services.Social;

public sealed record KeywordMatch(Guid KeywordId, string Keyword, string Action, string? Category);

/// <summary>
/// 用 Aho-Corasick 自動機比對貼文/留言內容有沒有命中違規關鍵字表（<c>social.ContentKeywords</c>）。
/// API 與 MVC 後台是不同程序；每次提交內容時重新讀取規則，避免 API 持續使用後台修改前的快取。
/// </summary>
public sealed class KeywordFilterService(IServiceScopeFactory scopeFactory)
{
    private readonly SemaphoreSlim _reloadLock = new(1, 1);

    public async Task<IReadOnlyList<KeywordMatch>> ScanAsync(string content, CancellationToken cancellationToken = default)
    {
        var automaton = await ReloadAsync(cancellationToken);
        return automaton.Scan(content);
    }

    /// <summary>從資料庫載入啟用中的關鍵字並重建自動機。</summary>
    public async Task<AhoCorasickAutomaton> ReloadAsync(CancellationToken cancellationToken = default)
    {
        await _reloadLock.WaitAsync(cancellationToken);
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
            var keywords = await db.ContentKeywords
                .AsNoTracking()
                .Where(k => k.IsActive)
                .Select(k => new KeywordMatch(k.Id, k.Keyword, k.Action, k.Category))
                .ToListAsync(cancellationToken);

            var automaton = new AhoCorasickAutomaton(keywords);
            return automaton;
        }
        finally
        {
            _reloadLock.Release();
        }
    }
}

/// <summary>
/// 標準 Aho-Corasick：Trie + failure link，一次掃描就能找出所有命中的關鍵字，不用對每個關鍵字各掃一次全文。
/// 建好之後是唯讀、immutable 的，可以安全被多執行緒同時拿去 <see cref="Scan"/>。
/// </summary>
public sealed class AhoCorasickAutomaton
{
    private sealed class Node
    {
        public Dictionary<char, Node> Children { get; } = [];
        public Node Fail { get; set; } = null!;
        public List<int> KeywordIndexes { get; } = [];
    }

    private readonly Node _root = new();
    private readonly IReadOnlyList<KeywordMatch> _keywords;

    public AhoCorasickAutomaton(IReadOnlyList<KeywordMatch> keywords)
    {
        _keywords = keywords;
        for (var i = 0; i < keywords.Count; i++)
            Insert(Normalize(keywords[i].Keyword), i);
        BuildFailureLinks();
    }

    public IReadOnlyList<KeywordMatch> Scan(string text)
    {
        if (_keywords.Count == 0)
            return [];

        var normalized = Normalize(text);
        var node = _root;
        HashSet<int>? matchedIndexes = null;

        foreach (var ch in normalized)
        {
            while (node != _root && !node.Children.ContainsKey(ch))
                node = node.Fail;
            node = node.Children.TryGetValue(ch, out var next) ? next : _root;

            if (node.KeywordIndexes.Count > 0)
            {
                matchedIndexes ??= [];
                matchedIndexes.UnionWith(node.KeywordIndexes);
            }
        }

        return matchedIndexes is null
            ? []
            : matchedIndexes.Select(i => _keywords[i]).ToList();
    }

    private void Insert(string keyword, int index)
    {
        var node = _root;
        foreach (var ch in keyword)
        {
            if (!node.Children.TryGetValue(ch, out var next))
            {
                next = new Node();
                node.Children[ch] = next;
            }
            node = next;
        }
        node.KeywordIndexes.Add(index);
    }

    private void BuildFailureLinks()
    {
        var queue = new Queue<Node>();
        foreach (var child in _root.Children.Values)
        {
            child.Fail = _root;
            queue.Enqueue(child);
        }

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var (ch, child) in current.Children)
            {
                var fail = current.Fail;
                while (fail != _root && !fail.Children.ContainsKey(ch))
                    fail = fail.Fail;
                child.Fail = fail.Children.TryGetValue(ch, out var failChild) && failChild != child ? failChild : _root;

                // 合併 fail link 節點本身也命中的關鍵字：掃到這個節點時，等於同時命中所有「這個字尾同時也是結尾」的關鍵字。
                if (child.Fail.KeywordIndexes.Count > 0)
                    child.KeywordIndexes.AddRange(child.Fail.KeywordIndexes);

                queue.Enqueue(child);
            }
        }
    }

    // 去空白 + 轉大寫：擋掉「詐 騙」這種插空白規避比對的手法，也讓英數關鍵字不分大小寫。
    private static string Normalize(string text) =>
        new string([.. text.Where(c => !char.IsWhiteSpace(c))]).ToUpperInvariant();
}
