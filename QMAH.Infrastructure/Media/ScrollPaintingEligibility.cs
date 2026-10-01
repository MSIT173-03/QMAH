using System.Buffers.Binary;

namespace QMAH.Infrastructure.Media;

/// <summary>從本機原圖標頭判斷題目比例，不依賴文物名稱或實體尺寸，也不下載遠端網址。</summary>
public sealed class ScrollPaintingEligibility(QmahMediaStoragePaths paths)
{
    public bool IsEligible(string imagePath)
    {
        var normalized = imagePath.Replace('\\', '/');
        var root = normalized.StartsWith("/media/", StringComparison.Ordinal) ? paths.PublicRoot
            : normalized.StartsWith("/images/", StringComparison.Ordinal) ? paths.ImageRoot : null;
        if (root is null) return false;
        try
        {
            var relative = normalized[(normalized.IndexOf('/', 1) + 1)..];
            var fullRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar;
            var file = Path.GetFullPath(Path.Combine(root, relative));
            if (!file.StartsWith(fullRoot, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)) return false;
            using var stream = File.OpenRead(file);
            var (width, height) = ReadDimensions(stream);
            var ratio = height > 0 ? (double)width / height : 0;
            return width >= 300 && height >= 240 && ratio >= .5 && ratio <= 2.2;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return false;
        }
    }

    public static (int Width, int Height) ReadDimensions(Stream stream)
    {
        Span<byte> header = stackalloc byte[30];
        if (stream.ReadAtLeast(header, 30, false) < 30) return (0, 0);
        if (header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            return (BinaryPrimitives.ReadInt32BigEndian(header[16..20]), BinaryPrimitives.ReadInt32BigEndian(header[20..24]));
        if (header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8))
        {
            if (header[12..16].SequenceEqual("VP8X"u8))
                return (1 + UInt24(header[24..27]), 1 + UInt24(header[27..30]));
            if (header[12..16].SequenceEqual("VP8 "u8) && header[23..26].SequenceEqual(new byte[] { 157, 1, 42 }))
                return (BinaryPrimitives.ReadUInt16LittleEndian(header[26..28]) & 0x3fff, BinaryPrimitives.ReadUInt16LittleEndian(header[28..30]) & 0x3fff);
            if (header[12..16].SequenceEqual("VP8L"u8) && header[20] == 47)
            {
                var bits = BinaryPrimitives.ReadUInt32LittleEndian(header[21..25]);
                return ((int)(bits & 0x3fff) + 1, (int)((bits >> 14) & 0x3fff) + 1);
            }
            return (0, 0);
        }
        if (header[0] != 255 || header[1] != 216) return (0, 0);
        stream.Position = 2;
        // 限制標頭掃描範圍，不解碼整張圖片。
        while (stream.Position < Math.Min(stream.Length, 1024 * 1024))
        {
            if (stream.ReadByte() != 255) return (0, 0);
            int marker;
            do { marker = stream.ReadByte(); } while (marker == 255);
            if (marker < 0 || marker is 217 or 218) return (0, 0);
            if (marker is 216 or 1 || marker is >= 208 and <= 215) continue;
            var high = stream.ReadByte();
            var low = stream.ReadByte();
            if (high < 0 || low < 0) return (0, 0);
            var length = (high << 8) | low;
            if (length < 2 || stream.Position + length - 2 > stream.Length) return (0, 0);
            if (marker is >= 192 and <= 195 or >= 197 and <= 199 or >= 201 and <= 203 or >= 205 and <= 207)
            {
                if (length < 8) return (0, 0);
                stream.ReadExactly(header[..5]);
                return (BinaryPrimitives.ReadUInt16BigEndian(header[3..5]), BinaryPrimitives.ReadUInt16BigEndian(header[1..3]));
            }
            stream.Seek(length - 2, SeekOrigin.Current);
        }
        return (0, 0);
    }

    private static int UInt24(ReadOnlySpan<byte> bytes) => bytes[0] | bytes[1] << 8 | bytes[2] << 16;
}
