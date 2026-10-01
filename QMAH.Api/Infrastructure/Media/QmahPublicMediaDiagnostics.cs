using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Infrastructure.Media;

/// <summary>只對資料庫實際引用、但本機缺少的公開媒體目錄提出警告。</summary>
public static class QmahPublicMediaDiagnostics
{
    public static async Task LogMissingDirectoriesAsync(
        string mediaRoot,
        QmahDbContext db,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        foreach (var segment in new[] { "catalog", "store" })
        {
            var segmentPath = Path.Combine(mediaRoot, segment);
            if (Directory.Exists(segmentPath))
                continue;

            // 商城可以共用圖鑑圖片；沒有獨立商品圖時不需要 store 目錄。
            // 同時核對縮圖與社群既有媒體參照，不靠空資料夾掩蓋缺圖。
            var prefix = $"/media/{segment}/";
            var hasReferences = await db.Artifacts.Select(artifact => artifact.PrimaryImagePath)
                .Concat(db.Artifacts.Select(artifact => artifact.ThumbnailPath))
                .Concat(db.Products.Select(product => product.PrimaryImagePath))
                .Concat(db.MediaAssets.Select(asset => (string?)asset.StoredPath))
                .AnyAsync(path => path != null && path.StartsWith(prefix), cancellationToken);

            if (hasReferences)
            {
                logger.LogWarning(
                    "資料庫已引用 /media/{Segment}/ 圖片，但本機公開媒體資料夾不存在，相關圖片將回傳 404。請確認 Media:AssetRootPath 或 Media:RootPath，或補齊素材。路徑：{SegmentPath}",
                    segment,
                    segmentPath);
            }
        }
    }
}
