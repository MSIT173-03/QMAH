using System.Collections.Concurrent;
using SkiaSharp;

namespace QMAH.Infrastructure.Media;

public sealed class GameImageAnalyzer(ScrollPaintingEligibility eligibility)
{
    private static readonly ConcurrentDictionary<(string Path, int Columns, int Rows), int[]?> BackgroundCache = new();

    public IReadOnlyList<int>? BackgroundPieces(string imagePath, int columns = 5, int rows = 5)
    {
        if (columns is < 1 or > 10 || rows is < 1 or > 10)
            throw new ArgumentOutOfRangeException(nameof(columns));
        return BackgroundCache.GetOrAdd((imagePath, columns, rows), key => AnalyzeBackground(key.Path, key.Columns, key.Rows));
    }

    internal static SKBitmap? LoadSample(string file, int width = 120, int height = 120)
    {
        using var original = SKBitmap.Decode(file);
        if (original is null) return null;
        var sample = new SKBitmap(width, height);
        using var canvas = new SKCanvas(sample);
        canvas.Clear(SKColors.White);
        using var source = SKImage.FromBitmap(original);
        canvas.DrawImage(source, new SKRect(0, 0, width, height), new SKSamplingOptions(SKFilterMode.Linear));
        return sample;
    }

    private int[]? AnalyzeBackground(string imagePath, int columns, int rows)
    {
        var file = eligibility.ResolveFile(imagePath);
        if (file is null) return null;
        try
        {
            const int size = 360;
            using var image = LoadSample(file, size, size);
            if (image is null) return null;
            var pixels = image.Pixels;
            var border = new List<SKColor>();
            for (var i = 0; i < size; i++)
            {
                border.Add(pixels[i]); border.Add(pixels[(size - 1) * size + i]);
                border.Add(pixels[i * size]); border.Add(pixels[i * size + size - 1]);
            }
            int Median(Func<SKColor, byte> channel) => border.Select(channel).Order().ElementAt(border.Count / 2);
            var background = new[] { Median(p => p.Red), Median(p => p.Green), Median(p => p.Blue) };
            var mask = new byte[pixels.Length];
            var edges = new bool[pixels.Length];
            for (var y = 0; y < size; y++) for (var x = 0; x < size; x++)
            {
                var index = y * size + x;
                var pixel = pixels[index];
                var left = pixels[y * size]; var right = pixels[y * size + size - 1];
                var t = x / (double)(size - 1);
                bool Similar(byte value, int global, byte localLeft, byte localRight) =>
                    Math.Abs(value - global) <= 28 || Math.Abs(value - (localLeft * (1 - t) + localRight * t)) <= 28;
                if (Similar(pixel.Red, background[0], left.Red, right.Red)
                    && Similar(pixel.Green, background[1], left.Green, right.Green)
                    && Similar(pixel.Blue, background[2], left.Blue, right.Blue)) mask[index] = 1;
                edges[index] = Difference(pixels[y * size + Math.Max(0, x - 1)], pixels[y * size + Math.Min(size - 1, x + 1)]) > 8
                    || Difference(pixels[Math.Max(0, y - 1) * size + x], pixels[Math.Min(size - 1, y + 1) * size + x]) > 8;
            }
            // 只接受與外框相連的平坦背景，避免把文物內部的素色區域當成背景。
            var queue = new Queue<int>();
            void Visit(int index)
            {
                if (mask[index] != 1 || edges[index]) return;
                mask[index] = 2; queue.Enqueue(index);
            }
            for (var i = 0; i < size; i++)
            {
                Visit(i); Visit((size - 1) * size + i); Visit(i * size); Visit(i * size + size - 1);
            }
            while (queue.TryDequeue(out var index))
            {
                if (index % size > 0) Visit(index - 1);
                if (index % size < size - 1) Visit(index + 1);
                if (index >= size) Visit(index - size);
                if (index < pixels.Length - size) Visit(index + size);
            }
            var pieces = new List<int>();
            for (var piece = 0; piece < columns * rows; piece++)
            {
                var left = piece % columns * size / columns; var right = (piece % columns + 1) * size / columns;
                var top = piece / columns * size / rows; var bottom = (piece / columns + 1) * size / rows;
                int connected = 0, detail = 0;
                for (var y = top; y < bottom; y++) for (var x = left; x < right; x++)
                {
                    var index = y * size + x;
                    if (mask[index] == 2) connected++;
                    if (edges[index]) detail++;
                }
                var area = (right - left) * (bottom - top);
                if (connected >= area * .985 && detail <= area * .005) pieces.Add(piece);
            }
            return pieces.ToArray();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return null;
        }
    }

    private static int Difference(SKColor a, SKColor b) =>
        Math.Max(Math.Abs(a.Red - b.Red), Math.Max(Math.Abs(a.Green - b.Green), Math.Abs(a.Blue - b.Blue)));
}
