using System.Collections.Concurrent;
using SkiaSharp;

namespace QMAH.Infrastructure.Media;

public sealed partial class LocatorSubjectFinder
{
    private static readonly ConcurrentDictionary<(string Path, long Modified, long Length), (double X, double Y, double Fraction)[]> OriginalCache = new();
    // 使用原圖像素檢查整個實際裁切範圍，不將稀疏格子誤認為完整文物。
    private (double X, double Y, double Fraction)[] OriginalCandidates(string imagePath)
    {
        var file = eligibility.ResolveFile(imagePath);
        if (file is null) return [];
        try
        {
            var info = new FileInfo(file);
            return OriginalCache.GetOrAdd((file, info.LastWriteTimeUtc.Ticks, info.Length), _ => AnalyzeOriginal(file));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return [];
        }
    }

    private static (double X, double Y, double Fraction)[] AnalyzeOriginal(string file)
    {
        try
        {
            using var image = SKBitmap.Decode(file);
            if (image is null || image.Width < 25 || image.Height < 25) return [];
            var width = image.Width;
            var height = image.Height;
            var pixels = image.Pixels;
            
            var options = new List<((double X, double Y, double Fraction) Point, double Quality)>();
            int Difference(SKColor a, SKColor b) => Math.Max(Math.Abs(a.Red - b.Red), Math.Max(Math.Abs(a.Green - b.Green), Math.Abs(a.Blue - b.Blue)));
            SKColor Border(int y, int start)
            {
                byte Median(Func<SKColor, byte> channel) => Enumerable.Range(start, 5).Select(x => channel(pixels[y * width + x])).Order().ElementAt(2);
                return new SKColor(Median(p => p.Red), Median(p => p.Green), Median(p => p.Blue));
            }
            var left = new SKColor[height];
            var right = new SKColor[height];
            for (var y = 0; y < height; y++) { left[y] = Border(y, 0); right[y] = Border(y, width - 5); }
            bool Foreground(int x, int y)
            {
                var t = x / (double)(width - 1);
                var background = new SKColor((byte)(left[y].Red * (1 - t) + right[y].Red * t), (byte)(left[y].Green * (1 - t) + right[y].Green * t), (byte)(left[y].Blue * (1 - t) + right[y].Blue * t));
                var pixel = pixels[y * width + x];
                return Difference(pixel, background) > 28 && Difference(pixel, left[y]) > 28 && Difference(pixel, right[y]) > 28;
            }
            foreach (var fraction in new[] { .30, .25, .20 })
            {
                var side = (int)Math.Floor(Math.Min(width, height) * fraction);
                var step = Math.Max(1, side / 80);
                for (var row = 3; row <= 16; row++) for (var column = 3; column <= 16; column++)
                {
                    var cx = (column + .5) / 20;
                    var cy = (row + .5) / 20;
                    // 館藏掃描圖底部常有色卡或編號，不拿這些區域當題目線索。
                    if (cy + side / 2d / height > .85) continue;
                    var centerX = (int)(cx * width);
                    var centerY = (int)(cy * height);
                    if (!Foreground(centerX, centerY)) continue;
                    int total = 0, subject = 0, detail = 0;
                    var quadrants = new int[4];
                    int centralTotal = 0, centralDetail = 0;
                    var tones = new List<SKColor>();
                    for (var y = centerY - side / 2; y < centerY + side / 2; y += step)
                        for (var x = centerX - side / 2; x < centerX + side / 2; x += step)
                        {
                            total++;
                            var central = Math.Abs(x - centerX) < side * .15 && Math.Abs(y - centerY) < side * .15;
                            if (central) { centralTotal++; tones.Add(pixels[y * width + x]); }
                            if (!Foreground(x, y)) continue;
                            subject++;
                            var pixel = pixels[y * width + x];
                            var x0 = Math.Max(0, x - step); var x1 = Math.Min(width - 1, x + step);
                            var y0 = Math.Max(0, y - step); var y1 = Math.Min(height - 1, y + step);
                            if (!Foreground(x0, y) || !Foreground(x1, y) || !Foreground(x, y0) || !Foreground(x, y1)) continue;
                            int Curvature(Func<SKColor, byte> channel) => Math.Max(
                                Math.Abs(2 * channel(pixel) - channel(pixels[y * width + x0]) - channel(pixels[y * width + x1])),
                                Math.Abs(2 * channel(pixel) - channel(pixels[y0 * width + x]) - channel(pixels[y1 * width + x])));
                            // 二階變化排除平滑打光與陰影漸層，細節必須分散在裁切區內。
                            if (Math.Max(Curvature(p => p.Red), Math.Max(Curvature(p => p.Green), Curvature(p => p.Blue))) < 24) continue;
                            detail++;
                            quadrants[(y >= centerY ? 2 : 0) + (x >= centerX ? 1 : 0)]++;
                            if (central) centralDetail++;
                        }
                    var coverage = subject / (double)total;
                    var texture = detail / (double)total;
                    int Contrast(Func<SKColor, byte> channel)
                    {
                        var values = tones.Select(channel).Order().ToArray();
                        return values.Length == 0 ? 0 : values[(int)((values.Length - 1) * .95)] - values[(int)((values.Length - 1) * .05)];
                    }
                    var lightSurface = tones.Count > 0 && tones.Average(p => (p.Red + p.Green + p.Blue) / 3d) > 170;
                    var requiredContrast = lightSurface ? 65 : 40;
                    if (coverage >= .65 && texture >= .04
                        && quadrants.Count(count => count >= total * .0025) >= 3
                        && centralTotal > 0 && centralDetail >= centralTotal * .015
                        && Math.Max(Contrast(p => p.Red), Math.Max(Contrast(p => p.Green), Contrast(p => p.Blue))) >= requiredContrast)
                        options.Add(((cx, cy, fraction), coverage + Math.Min(texture, .3)));
                }
            }
            // 留下接近最佳的區域，種子仍能產生不同題目，但不退回空白位置。
            var best = options.Count == 0 ? 0 : options.Max(option => option.Quality);
            return options.Where(option => option.Quality >= best - .15).GroupBy(option => (option.Point.X, option.Point.Y)).Select(group => group.First().Point).ToArray();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return [];
        }
    }
}
