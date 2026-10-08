using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 社群貼文的格式標記（類似巴哈姆特／論壇的 BBCode，不是 HTML）。貼文以純文字儲存，標記只在顯示時解析：
/// 前端以節點樹輸出元素與文字插值，後端（API 摘要、後台預覽）用這個類別。語法與白名單必須與
/// QMAH.Client/src/app/shared/social-markup.ts 保持一致。
/// 支援的標記（不分大小寫，可巢狀；不成對的標記自動補齊，未知標記原樣顯示）：
///   [b] [i] [u] [s]　[size=small|large|xlarge]　[color=red|brown|green|blue|gold|gray]
///   [h]小標題[/h]　[quote]引用[/quote]　[list][*]項目[/list]　[center]置中[/center]
///   [spoiler]劇透[/spoiler]　[url=https://…]連結文字[/url]（只允許 http／https）　[hr]分隔線
///   [img=圖片識別碼]（留言附圖：只接受本站上傳圖片的 GUID，不接受外部網址）
/// 輸出的 HTML 一律把使用者文字做 HTML 編碼，標籤只會由白名單產生，不可能夾帶 script 或事件屬性。
/// </summary>
public static class SocialMarkup
{
    private static readonly string[] Sizes = ["small", "large", "xlarge"];
    private static readonly string[] Colors = ["red", "brown", "green", "blue", "gold", "gray"];
    private static readonly HashSet<string> BlockTags = ["h", "quote", "list", "center", "spoiler"];
    private const int MaxDepth = 8;
    private const int MaxNodes = 4000;

    private static readonly Regex Tag = new(
        @"\[(/?)(b|i|u|s|h|quote|list|size|color|url|center|spoiler|hr|img|\*)(?:=([^\]\s]{1,300}))?\]",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private sealed class Node
    {
        public string? Text;
        public string Name = "";
        public string? Arg;
        public List<Node> Children = [];
        public List<List<Node>>? Items;
        public bool IsText => Text is not null;
    }

    private sealed class Frame
    {
        public string Name = "";
        public string? Arg;
        public List<Node> Children = [];
        public List<List<Node>>? Items;
        public bool Marked;
    }

    /// <summary>移除所有標記，供列表摘要等純文字場合使用。</summary>
    private static readonly Regex ImageTagRegex = new(
        @"[img=([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})]",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>取出內容中所有 [img=識別碼] 引用的圖片識別碼（去重）。</summary>
    public static IReadOnlyList<Guid> ExtractImageIds(string? content) =>
        string.IsNullOrEmpty(content)
            ? []
            : ImageTagRegex.Matches(content).Select(m => Guid.Parse(m.Groups[1].Value)).Distinct().ToList();

    public static string ToPlainText(string? content, int maxLength = 0)
    {
        if (string.IsNullOrEmpty(content)) return "";
        var text = Regex.Replace(Plain(Parse(content)), @"\s*\n\s*", " ").Trim();
        if (maxLength > 0 && text.Length > maxLength)
        {
            // 不要切在表情符號（代理對）中間
            var cut = char.IsHighSurrogate(text[maxLength - 1]) ? maxLength - 1 : maxLength;
            text = text[..cut] + "…";
        }
        return text;
    }

    /// <summary>轉成可安全嵌入頁面的 HTML（文字一律編碼，標籤只來自白名單）。</summary>
    public static string ToHtml(string? content)
    {
        if (string.IsNullOrEmpty(content)) return "";
        var sb = new StringBuilder();
        Render(Parse(content), sb);
        return sb.ToString();
    }

    private static bool ValidArg(string name, string? arg) => name switch
    {
        "size" => arg is not null && Sizes.Contains(arg.ToLowerInvariant()),
        "color" => arg is not null && Colors.Contains(arg.ToLowerInvariant()),
        "url" => IsSafeUrl(arg),
        "img" => arg is not null && Guid.TryParseExact(arg, "D", out _),
        _ => string.IsNullOrEmpty(arg),
    };

    private static bool IsSafeUrl(string? url) =>
        !string.IsNullOrEmpty(url)
        && url.Length <= 300
        && (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        && Uri.TryCreate(url, UriKind.Absolute, out _)
        && !url.Any(ch => ch is '<' or '>' or '"' or '\'' or '`' or '\\');

    /// <summary>舊版貼文使用的行首標記（【小標】、• 項目、> 引用、「引用」），轉成標記語法後一起解析。</summary>
    public static string LegacyToMarkup(string content)
    {
        var lines = content.Replace("\r\n", "\n").Split('\n');
        var output = new List<string>();
        var inList = false;
        void CloseList()
        {
            if (inList) { output.Add("[/list]"); inList = false; }
        }
        foreach (var line in lines)
        {
            var text = line.Trim();
            if (text.StartsWith("• ", StringComparison.Ordinal))
            {
                if (!inList) { output.Add("[list]"); inList = true; }
                output.Add("[*]" + text[2..]);
                continue;
            }
            CloseList();
            if (text.Length >= 2 && text.StartsWith('【') && text.EndsWith('】')) output.Add("[h]" + text[1..^1] + "[/h]");
            else if (text.StartsWith("> ", StringComparison.Ordinal)) output.Add("[quote]" + text[2..] + "[/quote]");
            else if (text.Length >= 2 && text.StartsWith('「') && text.EndsWith('」')) output.Add("[quote]" + text[1..^1] + "[/quote]");
            else output.Add(line);
        }
        CloseList();
        return string.Join('\n', output);
    }

    private static List<Node> Parse(string source)
    {
        var input = LegacyToMarkup(source);
        var root = new List<Node>();
        var stack = new List<Frame>();
        var nodeCount = 0;

        List<Node> Current() => stack.Count > 0 ? stack[^1].Children : root;
        void PushText(string value)
        {
            if (value.Length == 0) return;
            var target = Current();
            if (target.Count > 0 && target[^1].IsText) target[^1].Text += value;
            else { target.Add(new Node { Text = value }); nodeCount++; }
        }
        void FinishItem(Frame frame)
        {
            if (frame.Items is null) return;
            if (frame.Marked) frame.Items.Add(frame.Children);
            frame.Children = [];
        }
        void Close()
        {
            var frame = stack[^1];
            stack.RemoveAt(stack.Count - 1);
            var node = new Node { Name = frame.Name, Arg = frame.Arg, Children = frame.Children, Items = frame.Items };
            Current().Add(node);
        }

        var cursor = 0;
        foreach (Match match in Tag.Matches(input))
        {
            if (nodeCount >= MaxNodes) break;
            var slash = match.Groups[1].Value.Length > 0;
            var name = match.Groups[2].Value.ToLowerInvariant();
            var arg = match.Groups[3].Success ? match.Groups[3].Value : null;
            PushText(input[cursor..match.Index]);
            cursor = match.Index + match.Length;

            if (name == "*")
            {
                var list = stack.Count > 0 ? stack[^1] : null;
                if (!slash && list is { Name: "list", Items: not null })
                {
                    FinishItem(list);
                    list.Marked = true;
                }
                else PushText(match.Value);
                continue;
            }

            if (name == "hr")
            {
                if (slash || arg is not null) PushText(match.Value);
                else { Current().Add(new Node { Name = "hr" }); nodeCount++; }
                if (!slash && cursor < input.Length && input[cursor] == '\n') cursor++;
                continue;
            }

            if (name == "img")
            {
                if (slash || !ValidArg("img", arg)) PushText(match.Value);
                else { Current().Add(new Node { Name = "img", Arg = arg!.ToLowerInvariant() }); nodeCount++; }
                continue;
            }

            if (slash)
            {
                var at = stack.FindLastIndex(frame => frame.Name == name);
                if (at < 0) { PushText(match.Value); continue; }
                while (stack.Count - 1 > at) Close();
                FinishItem(stack[^1]);
                Close();
                if (BlockTags.Contains(name) && cursor < input.Length && input[cursor] == '\n') cursor++;
                continue;
            }

            var normalizedArg = name == "url" ? arg : arg?.ToLowerInvariant();
            if (!ValidArg(name, normalizedArg) || stack.Count >= MaxDepth) { PushText(match.Value); continue; }
            stack.Add(new Frame { Name = name, Arg = normalizedArg, Items = name == "list" ? [] : null });
            nodeCount++;
            if (BlockTags.Contains(name) && cursor < input.Length && input[cursor] == '\n') cursor++;
        }
        PushText(input[cursor..]);
        while (stack.Count > 0)
        {
            FinishItem(stack[^1]);
            Close();
        }
        return root;
    }

    private static string Plain(List<Node> nodes)
    {
        var sb = new StringBuilder();
        foreach (var node in nodes)
        {
            if (node.IsText) sb.Append(node.Text);
            else if (node.Name == "hr") sb.Append(' ');
            else if (node.Name == "img") sb.Append("（圖片）");
            else if (node.Items is not null)
                sb.Append(string.Join(' ', node.Items.Select(item => Plain(item).Trim()).Where(item => item.Length > 0)));
            else sb.Append(Plain(node.Children));
        }
        return sb.ToString();
    }

    private static void Render(List<Node> nodes, StringBuilder sb)
    {
        foreach (var node in nodes)
        {
            if (node.IsText)
            {
                sb.Append(WebUtility.HtmlEncode(node.Text!).Replace("\n", "<br>"));
                continue;
            }
            switch (node.Name)
            {
                case "b": Wrap("strong", node, sb); break;
                case "i": Wrap("em", node, sb); break;
                case "u": Wrap("u", node, sb); break;
                case "s": Wrap("s", node, sb); break;
                case "h": Wrap("h3", node, sb); break;
                case "quote": Wrap("blockquote", node, sb); break;
                case "center": sb.Append("<div style=\"text-align:center\">"); Render(node.Children, sb); sb.Append("</div>"); break;
                case "spoiler": sb.Append("<span class=\"qmah-spoiler\">"); Render(node.Children, sb); sb.Append("</span>"); break;
                case "hr": sb.Append("<hr>"); break;
                case "img": sb.Append("<em>（附圖）</em>"); break;
                case "size": sb.Append("<span class=\"qmah-size-").Append(node.Arg).Append("\">"); Render(node.Children, sb); sb.Append("</span>"); break;
                case "color": sb.Append("<span class=\"qmah-color-").Append(node.Arg).Append("\">"); Render(node.Children, sb); sb.Append("</span>"); break;
                case "url":
                    sb.Append("<a href=\"").Append(WebUtility.HtmlEncode(node.Arg!)).Append("\" target=\"_blank\" rel=\"noopener noreferrer nofollow\">");
                    Render(node.Children, sb);
                    sb.Append("</a>");
                    break;
                case "list":
                    sb.Append("<ul>");
                    foreach (var item in node.Items ?? []) { sb.Append("<li>"); Render(item, sb); sb.Append("</li>"); }
                    sb.Append("</ul>");
                    break;
            }
        }
    }

    private static void Wrap(string tag, Node node, StringBuilder sb)
    {
        sb.Append('<').Append(tag).Append('>');
        Render(node.Children, sb);
        sb.Append("</").Append(tag).Append('>');
    }
}
