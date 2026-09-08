using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Infrastructure.CatalogImport;

public sealed class NpmCatalogSourceService(
    QmahDbContext db,
    NpmOpenDataClient npmClient)
{
    private static readonly EraRule[] EraRules =
    [
        new("JAPAN_MEIJI", 1868, 1912, "日本明治時代", "明治時代", "明治"),
        new("JAPAN_TAISHO", 1912, 1926, "日本大正時代", "大正時代", "大正"),
        new("MING", 1368, 1644, "明朝", "明代", "大明", "嘉靖", "萬曆", "永樂", "宣德", "成化"),
        new("QING", 1644, 1912, "清朝", "清代", "大清", "康熙", "雍正", "乾隆", "嘉慶", "道光", "咸豐", "同治", "光緒", "宣統"),
        new("YUAN", 1271, 1368, "元朝", "元代", "大元", "至大", "至元", "延祐"),
        new("WESTERN_XIA", 1038, 1227, "西夏", "大夏"),
        new("SONG", 960, 1279, "北宋", "南宋", "宋朝", "宋代", "大宋", "紹興", "淳熙"),
        new("TANG", 618, 907, "唐朝", "唐代", "大唐", "開元", "貞觀"),
        new("HAN", -206, 220, "西漢", "東漢", "漢朝", "漢代", "兩漢"),
        new("WARRING_STATES", -475, -221, "戰國時代", "戰國"),
        new("SPRING_AUTUMN", -770, -476, "春秋時代", "春秋"),
        new("ZHOU", -1046, -256, "西周", "東周", "周朝", "周代", "兩周")
    ];

    public async Task<IReadOnlyList<CatalogArtifactImportRow>> PrepareAsync(
        string dataset,
        string mode,
        int maxItems,
        string mediaRoot,
        CancellationToken cancellationToken = default,
        string order = "asc",
        string? fromRef = null,
        string? toRef = null,
        string? identifiers = null)
    {
        if (!NpmOpenDataClient.SupportedDatasets.TryGetValue(dataset, out var categoryCode))
            throw new InvalidDataException("請選擇有效的故宮資料集。");
        if (maxItems is < 1 or > 100)
            throw new InvalidDataException("每次新增或更新筆數必須介於 1 到 100。 ");

        var normalizedMode = mode?.Trim().ToLowerInvariant();
        if (normalizedMode is not ("new" or "update" or "both"))
            throw new InvalidDataException("請選擇新增、更新或兩者都處理。 ");
        if (order is not ("asc" or "desc"))
            throw new InvalidDataException("請選擇有效的編號排序。");
        if (!string.IsNullOrWhiteSpace(fromRef) && !string.IsNullOrWhiteSpace(toRef)
            && StringComparer.OrdinalIgnoreCase.Compare(fromRef.Trim(), toRef.Trim()) > 0)
            throw new InvalidDataException("起始編號不可大於結束編號。");
        var requestedRefs = (identifiers ?? "").Split(['\r', '\n', ',', '，', ';', '；'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var sourceRows = await npmClient.GetDatasetAsync(dataset, cancellationToken);
        var candidates = sourceRows
            .Select(row => TryCreateRow(row, dataset, categoryCode))
            .Where(row => row is not null)
            .Select(row => row!)
            .GroupBy(row => row.ArtifactRef, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(row => row.ArtifactRef, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingRefs = (await db.Artifacts
                .AsNoTracking()
                .Select(row => row.ArtifactRef)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        // 每次以資料庫現況排除既有編號，讓新增模式自然接續，無須儲存容易失準的分頁游標。
        // 範圍與指定清單取交集；先篩選再排序、限量，避免既有資料占用新增配額。
        var eligible = candidates.Where(row =>
            (normalizedMode == "both" || existingRefs.Contains(row.ArtifactRef) == (normalizedMode == "update"))
            && (string.IsNullOrWhiteSpace(fromRef) || StringComparer.OrdinalIgnoreCase.Compare(row.ArtifactRef, fromRef.Trim()) >= 0)
            && (string.IsNullOrWhiteSpace(toRef) || StringComparer.OrdinalIgnoreCase.Compare(row.ArtifactRef, toRef.Trim()) <= 0)
            && (requestedRefs.Count == 0 || requestedRefs.Contains(row.ArtifactRef)));
        // 故宮編號含文字前綴，統一採不區分大小寫的文字排序，與起訖範圍比較一致。
        var selected = (order == "desc"
                ? eligible.OrderByDescending(row => row.ArtifactRef, StringComparer.OrdinalIgnoreCase)
                : eligible.OrderBy(row => row.ArtifactRef, StringComparer.OrdinalIgnoreCase))
            .Take(maxItems).ToList();

        if (selected.Count == 0)
            return [];

        var prepared = new List<CatalogArtifactImportRow>(selected.Count);
        foreach (var row in selected)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (existingRefs.Contains(row.ArtifactRef))
            {
                prepared.Add(row);
                continue;
            }

            var relativeRoot = Path.Combine("catalog", categoryCode.ToLowerInvariant(), row.ArtifactRef);
            var displayPath = Path.Combine(relativeRoot, "display.jpg");
            var thumbnailPath = Path.Combine(relativeRoot, "thumbnail.jpg");
            try
            {
                await npmClient.DownloadImageAsync(
                    row.ImageUrl,
                    Path.Combine(mediaRoot, displayPath),
                    cancellationToken);
                await npmClient.DownloadImageAsync(
                    row.ThumbnailUrl,
                    Path.Combine(mediaRoot, thumbnailPath),
                    cancellationToken);
                prepared.Add(row with
                {
                    ImageUrl = displayPath.Replace(Path.DirectorySeparatorChar, '/'),
                    ThumbnailUrl = thumbnailPath.Replace(Path.DirectorySeparatorChar, '/')
                });
            }
            catch (Exception exception) when (exception is HttpRequestException or InvalidDataException)
            {
                DeleteIfExists(Path.Combine(mediaRoot, displayPath));
                DeleteIfExists(Path.Combine(mediaRoot, thumbnailPath));
            }
        }

        if (prepared.Count == 0)
            return [];

        return prepared;
    }

    private static CatalogArtifactImportRow? TryCreateRow(
        NpmExternalArtifactDto source,
        string dataset,
        string categoryCode)
    {
        if (string.IsNullOrWhiteSpace(source.Identifier)
            || string.IsNullOrWhiteSpace(source.Name)
            || string.IsNullOrWhiteSpace(source.Era)
            || string.IsNullOrWhiteSpace(source.Description)
            || string.IsNullOrWhiteSpace(source.SourceUrl)
            || string.IsNullOrWhiteSpace(source.MediumImageUrl)
            || string.IsNullOrWhiteSpace(source.SmallImageUrl))
        {
            return null;
        }

        var matches = MatchEra(source.Era);
        if (matches.Count != 1)
            return null;
        var era = matches[0];
        var name = source.Name.Trim();
        var artifactRef = source.Identifier.Trim();
        return new CatalogArtifactImportRow(
            StableGuid(artifactRef),
            artifactRef,
            name,
            categoryCode,
            string.IsNullOrWhiteSpace(source.Category)
                ? NpmOpenDataClient.GetDatasetDisplayName(dataset)
                : source.Category.Trim(),
            era.Bucket,
            source.Era.Trim(),
            source.Description.Trim(),
            source.SourceUrl.Trim(),
            source.MediumImageUrl.Trim(),
            JsonSerializer.Serialize(source),
            "AUTO_VERIFIED",
            true,
            $"{name} 國立故宮博物院，臺北，CC BY 4.0 @ www.npm.gov.tw",
            era.EndYear,
            era.StartYear,
            "CC-BY-4.0",
            source.Size?.Trim(),
            dataset,
            source.SmallImageUrl.Trim());
    }

    private static List<EraRule> MatchEra(string rawEra)
    {
        var era = rawEra.Normalize(NormalizationForm.FormKC)
            .Replace(" ", "", StringComparison.Ordinal)
            .Replace("　", "", StringComparison.Ordinal);
        return EraRules
            .Where(rule => rule.Tokens.Any(token => era.Contains(token, StringComparison.Ordinal)))
            .GroupBy(rule => rule.Bucket, StringComparer.Ordinal)
            .Select(group => group.OrderByDescending(rule => rule.Tokens.Max(token => token.Length)).First())
            .ToList();
    }

    private static Guid StableGuid(string value) =>
        new(SHA256.HashData(Encoding.UTF8.GetBytes(value))[..16]);

    private static void DeleteIfExists(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // 下一次預檢使用新的 stage；清理失敗不掩蓋來源圖片錯誤。
        }
    }

    private sealed record EraRule(string Bucket, int? StartYear, int? EndYear, params string[] Tokens);
}
