using System.Collections.Concurrent;
using SkiaSharp;

namespace QMAH.Infrastructure.Media;

/// <summary>
/// 細節追跡的目標點：在文物本體上挑，不挑到空白背景。
/// 縮小圖片後用「和邊緣背景色的差異」找出文物所在的格子（10×10），再依種子與文物 ID 挑一格；
/// 同一張圖永遠得到同一組格子，所以每局的目標只由種子決定。
/// </summary>
public sealed class LocatorSubjectFinder(ScrollPaintingEligibility eligibility)
{
    private const int Grid = 10;
    private static readonly ConcurrentDictionary<string, double[]?> DetailCache = new();
    public bool HasDetail(string imagePath)
    {
        var filled = Cache.GetOrAdd(imagePath, path => Subject(path));
        var detail = DetailCache.GetOrAdd(imagePath, path => Detail(path));
        return filled is not null && detail is not null && Enumerable.Range(0, Grid * Grid)
            .Any(i => i / Grid is >= 2 and <= 7 && i % Grid is >= 2 and <= 7 && filled[i] && detail[i] >= .025);
    }
    private static readonly ConcurrentDictionary<string, bool[]?> Cache = new();

    public (double X, double Y) Target(string seed, Guid artifactId, string imagePath)
    {
        var key = $"{seed}|{artifactId:D}";
        var fallback = ((3 + Hash(key) % 5) / 10d, (3 + Hash(key + "|y") % 5) / 10d);
        var filled = Cache.GetOrAdd(imagePath, path => Subject(path));
        if (filled is null) return fallback;
        var detailed = seed.StartsWith("v6-", StringComparison.Ordinal);
        var texture = detailed ? DetailCache.GetOrAdd(imagePath, path => Detail(path)) : null;
        var size = eligibility.ImageDimensions(imagePath);
        if (size.Width <= 0 || size.Height <= 0) return fallback;
        // 與計分的命中範圍相同：短邊五分之一見方
        var halfX = Math.Floor(Math.Min(size.Width, size.Height) / 5d) / 2 / size.Width;
        var halfY = Math.Floor(Math.Min(size.Width, size.Height) / 5d) / 2 / size.Height;
        double Covered(double x, double y)
        {
            int c0 = Math.Max(0, (int)Math.Floor((x - halfX) * Grid)), c1 = Math.Min(Grid - 1, (int)Math.Ceiling((x + halfX) * Grid) - 1);
            int r0 = Math.Max(0, (int)Math.Floor((y - halfY) * Grid)), r1 = Math.Min(Grid - 1, (int)Math.Ceiling((y + halfY) * Grid) - 1);
            int total = 0, on = 0;
            for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { total++; if (filled[r * Grid + c]) on++; }
            return total == 0 ? 0 : (double)on / total;
        }
        foreach (var need in new[] { .75, .5 })
        {
            var options = new List<(double X, double Y)>();
            for (var row = 2; row <= 7; row++)
                for (var column = 2; column <= 7; column++)
                {
                    var point = ((column + .5) / Grid, (row + .5) / Grid);
                    if (Covered(point.Item1, point.Item2) >= need && (!detailed || texture is not null && texture[row * Grid + column] >= .025)) options.Add(point);
                }
            if (options.Count > 0) return options[(int)(Hash(key + "|v5") % (uint)options.Count)];
        }
        if (detailed && texture is not null)
        {
            var best = Enumerable.Range(0, Grid * Grid)
                .Where(i => i / Grid is >= 2 and <= 7 && i % Grid is >= 2 and <= 7 && filled[i])
                .OrderByDescending(i => texture[i]).FirstOrDefault(-1);
            if (best >= 0) return ((best % Grid + .5) / Grid, (best / Grid + .5) / Grid);
        }
        return fallback;
    }

    private double[]? Detail(string imagePath)
    {
        var file = eligibility.ResolveFile(imagePath);
        if (file is null) return null;
        try
        {
            using var image = GameImageAnalyzer.LoadSample(file);
            if (image is null) return null;
            var edges = new double[Grid * Grid];
            for (var y = 1; y < 119; y++) for (var x = 1; x < 119; x++)
            {
                var p = image.GetPixel(x, y); var right = image.GetPixel(x + 1, y); var below = image.GetPixel(x, y + 1);
                var gradient = Math.Abs(p.Red - right.Red) + Math.Abs(p.Green - right.Green) + Math.Abs(p.Blue - right.Blue)
                    + Math.Abs(p.Red - below.Red) + Math.Abs(p.Green - below.Green) + Math.Abs(p.Blue - below.Blue);
                if (gradient >= 60) edges[y * Grid / 120 * Grid + x * Grid / 120]++;
            }
            for (var i = 0; i < edges.Length; i++) edges[i] /= 144d;
            return edges;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException) { return null; }
    }

    private bool[]? Subject(string imagePath)
    {
        var file = eligibility.ResolveFile(imagePath);
        if (file is null) return null;
        try
        {
            using var image = GameImageAnalyzer.LoadSample(file);
            if (image is null) return null;
            const int n = 120;
            var border = new List<SKColor>();
            for (var i = 0; i < n; i++) { border.Add(image.GetPixel(i, 0)); border.Add(image.GetPixel(i, n - 1)); border.Add(image.GetPixel(0, i)); border.Add(image.GetPixel(n - 1, i)); }
            byte Median(Func<SKColor, byte> channel) { var v = border.Select(channel).OrderBy(b => b).ToArray(); return v[v.Length / 2]; }
            var bg = (R: Median(p => p.Red), G: Median(p => p.Green), B: Median(p => p.Blue));
            // 打光常由上到下漸層：同一列左右兩側的顏色也當背景
            var count = new int[Grid * Grid];
            var subject = new int[Grid * Grid];
            for (var y = 0; y < n; y++)
            {
                var left = image.GetPixel(0, y); var right = image.GetPixel(n - 1, y);
                for (var x = 0; x < n; x++)
                {
                    var p = image.GetPixel(x, y);
                    var t = x / (double)(n - 1);
                    double lr = left.Red * (1 - t) + right.Red * t, lg = left.Green * (1 - t) + right.Green * t, lb = left.Blue * (1 - t) + right.Blue * t;
                    var nearGlobal = Math.Abs(p.Red - bg.R) <= 28 && Math.Abs(p.Green - bg.G) <= 28 && Math.Abs(p.Blue - bg.B) <= 28;
                    var nearLocal = Math.Abs(p.Red - lr) <= 28 && Math.Abs(p.Green - lg) <= 28 && Math.Abs(p.Blue - lb) <= 28;
                    var cell = (y * Grid / n) * Grid + x * Grid / n;
                    count[cell]++;
                    if (!nearGlobal && !nearLocal) subject[cell]++;
                }
            }
            var filled = new bool[Grid * Grid];
            for (var i = 0; i < filled.Length; i++) filled[i] = subject[i] >= count[i] * .3;
            return filled.Any(f => f) ? filled : null;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return null;
        }
    }

    private static uint Hash(string value)
    {
        var hash = 2166136261u;
        foreach (var character in value) hash = unchecked((hash ^ character) * 16777619u);
        return hash;
    }
}
