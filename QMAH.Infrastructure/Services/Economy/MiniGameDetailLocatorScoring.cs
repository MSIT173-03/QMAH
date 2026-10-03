using System.Text.Json;

namespace QMAH.Infrastructure.Services.Economy;

/// <summary>四件文物依序定位，以保存的素材池與種子驗證座標，不需新增資料表。</summary>
public static class MiniGameDetailLocatorScoring
{
    public static (double X, double Y) Target(string seed, Guid artifactId)
    {
        var key = $"{seed}|{artifactId:D}";
        return ((3 + Hash(key) % 5) / 10d, (3 + Hash(key + "|y") % 5) / 10d);
    }

    private static uint Hash(string value)
    {
        var hash = 2166136261u;
        foreach (var character in value) hash = unchecked((hash ^ character) * 16777619u);
        return hash;
    }

    public static int Calculate(JsonElement result, IReadOnlyCollection<Guid> artifactPool, string seed, IReadOnlyDictionary<Guid, (int Width, int Height)> imageSizes, out string? error)
    {
        error = null;
        if (artifactPool.Count != 4 || !result.TryGetProperty("locatorAnswers", out var answers)
            || answers.ValueKind != JsonValueKind.Array || answers.GetArrayLength() > artifactPool.Count)
        {
            error = "局部辨識必須送出本輪四件文物的定位座標。";
            return -1;
        }
        var pool = artifactPool.ToArray();
        var correct = 0;
        var index = 0;
        foreach (var answer in answers.EnumerateArray())
        {
            if (answer.ValueKind != JsonValueKind.Object || !answer.TryGetProperty("artifactId", out var id)
                || id.ValueKind != JsonValueKind.String || !id.TryGetGuid(out var artifactId) || artifactId != pool[index++]
                || !Coordinate(answer, "x", out var x) || !Coordinate(answer, "y", out var y)
                || !imageSizes.TryGetValue(artifactId, out var size) || size.Width <= 0 || size.Height <= 0
                || !Dimension(answer, "imageWidth", size.Width) || !Dimension(answer, "imageHeight", size.Height))
            {
                error = "定位座標必須依本輪文物順序送出，且位於原圖內。";
                return -1;
            }
            var target = Target(seed, artifactId);
            var halfSize = Math.Floor(Math.Min(size.Width, size.Height) / 5d) / 2;
            if (Math.Abs(x - target.X) <= halfSize / size.Width + 1e-9 && Math.Abs(y - target.Y) <= halfSize / size.Height + 1e-9) correct++;
        }
        if (result.TryGetProperty("locatorAssistedIds", out var assisted))
        {
            if (assisted.ValueKind != JsonValueKind.Array || assisted.GetArrayLength() + index != 4
                || !result.TryGetProperty("autoPlaced", out var count) || count.ValueKind != JsonValueKind.Number
                || !count.TryGetInt32(out var autoPlaced) || autoPlaced != assisted.GetArrayLength())
            { error = "協助定位紀錄與剩餘題數不一致。"; return -1; }
            foreach (var id in assisted.EnumerateArray())
            {
                if (id.ValueKind != JsonValueKind.String || !id.TryGetGuid(out var artifactId) || artifactId != pool[index++])
                { error = "協助定位的文物必須依本輪順序送出。"; return -1; }
                correct++;
            }
        }
        if (index != 4) { error = "本輪文物尚未全部定位。"; return -1; }
        return correct * 25;
    }

    private static bool Dimension(JsonElement answer, string name, int expected)
        => answer.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var value) && value == expected;

    private static bool Coordinate(JsonElement answer, string name, out double value)
    {
        value = 0;
        return answer.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.Number
            && property.TryGetDouble(out value) && double.IsFinite(value) && value is >= 0 and <= 1;
    }
}
