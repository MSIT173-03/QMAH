using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Social.Services;

/// <summary>
/// 後台發布／編輯貼文時的圖片附件處理。
/// </summary>
/// <remarks>
/// 儲存規則刻意與 QMAH.Api 的 SocialMediaController 相同：檔名使用 MediaAssets.SequenceNo、
/// 實體檔案放在 Media:RootPath（預設兩個 host 都指向 QMAH.Media/media），
/// 資料庫只保存相對檔名。前台因此能直接透過 /api/v1/social/media/{id}/content 讀到後台上傳的圖片，
/// 貼文列表的封面（coverImageUrl）也會自動取第一張 ACTIVE 圖片。
/// </remarks>
public sealed class SocialPostMediaService(
    QmahDbContext db,
    QmahMediaStoragePaths mediaPaths,
    ILogger<SocialPostMediaService> logger)
{
    /// <summary>與前台發文相同：每篇最多 8 張、單張 8 MB。</summary>
    public const int MaxImagesPerPost = 8;
    public const long MaxFileSize = 8 * 1024 * 1024;
    /// <summary>整個表單的上限：8 張圖片 + 1 MB 的文字欄位餘裕。</summary>
    public const long MaxRequestSize = MaxImagesPerPost * MaxFileSize + (1024 * 1024);
    public const string AcceptAttribute = "image/jpeg,image/png,image/gif,image/webp";

    /// <summary>
    /// 在建立貼文之前先檢查全部檔案，避免貼文寫進資料庫後才發現圖片格式錯誤。
    /// </summary>
    public async Task<IReadOnlyList<string>> ValidateAsync(
        IEnumerable<IFormFile>? files,
        int existingCount,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var incoming = NonEmpty(files);

        if (existingCount + incoming.Count > MaxImagesPerPost)
        {
            errors.Add(existingCount > 0
                ? $"每篇貼文最多 {MaxImagesPerPost} 張圖片（目前保留 {existingCount} 張，這次選了 {incoming.Count} 張）。"
                : $"每篇貼文最多 {MaxImagesPerPost} 張圖片（這次選了 {incoming.Count} 張）。");
        }

        foreach (var file in incoming)
        {
            var name = DisplayName(file);
            if (file.Length > MaxFileSize)
            {
                errors.Add($"「{name}」超過 8 MB。");
                continue;
            }

            if (await ReadImageSignatureAsync(file, cancellationToken) is null)
                errors.Add($"「{name}」不是 JPEG、PNG、GIF 或 WebP 圖片。");
        }

        return errors;
    }

    /// <summary>
    /// 把圖片寫入共用媒體目錄並綁定到指定貼文，回傳儲存失敗的張數。
    /// 呼叫前貼文必須已經存在於資料庫（MediaAssets.PostId 有外鍵）。
    /// </summary>
    public async Task<int> AttachAsync(
        Guid postId,
        Guid ownerUserId,
        IEnumerable<IFormFile>? files,
        CancellationToken cancellationToken)
    {
        var incoming = NonEmpty(files);
        if (incoming.Count == 0)
            return 0;

        var root = mediaPaths.PublicRoot;
        Directory.CreateDirectory(root);

        var failed = 0;
        var baseTime = DateTime.UtcNow;
        for (var index = 0; index < incoming.Count; index++)
        {
            var file = incoming[index];
            var signature = await ReadImageSignatureAsync(file, cancellationToken);
            if (signature is null)
            {
                failed++;
                continue;
            }

            // 前台以 CreatedAt 最早的圖片當封面；逐張遞增 1ms，確保順序與選擇檔案的順序一致。
            var createdAt = baseTime.AddMilliseconds(index);
            var asset = new MediaAsset
            {
                Id = Guid.NewGuid(),
                OwnerUserId = ownerUserId,
                PostId = postId,
                OriginalFileName = TruncateFileName(file.FileName),
                // 先取得資料庫流水號，再用流水號當檔名（與 API 相同）。
                StoredPath = "pending",
                ContentType = signature.Value.ContentType,
                FileSize = file.Length,
                // 後台由具管理權限的人員上傳，視為已審核，不排入 AI 圖片複審。
                AiReviewedAt = createdAt,
                Status = "HIDDEN",
                CreatedAt = createdAt,
                UpdatedAt = createdAt
            };

            db.MediaAssets.Add(asset);
            await db.SaveChangesAsync(cancellationToken);

            var storedFileName = $"{asset.SequenceNo}{signature.Value.Extension}";
            var physicalPath = ResolvePhysicalPath(root, storedFileName);
            try
            {
                await using (var output = new FileStream(
                    physicalPath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    bufferSize: 64 * 1024,
                    options: FileOptions.Asynchronous))
                {
                    await file.CopyToAsync(output, cancellationToken);
                }

                asset.StoredPath = storedFileName;
                asset.Status = "ACTIVE";
                asset.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                failed++;
                logger.LogError(exception, "後台貼文圖片儲存失敗。PostId：{PostId}，檔名：{FileName}", postId, file.FileName);
                TryDeleteFile(physicalPath);
                asset.Status = "DELETED";
                asset.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(CancellationToken.None);
            }
        }

        return failed;
    }

    /// <summary>後台編輯頁顯示的既有圖片（只列 ACTIVE）。</summary>
    public Task<List<MediaAsset>> GetActiveAsync(Guid postId, CancellationToken cancellationToken) =>
        db.MediaAssets
            .AsNoTracking()
            .Where(asset => asset.PostId == postId && asset.Status == "ACTIVE")
            .OrderBy(asset => asset.CreatedAt)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// 軟刪除（與 API 相同只改 Status），實體檔案保留給後續清理流程。只會動到屬於這篇貼文的圖片。
    /// 只標記 tracked entity，由呼叫端統一 SaveChanges。
    /// </summary>
    public async Task<int> MarkDeletedAsync(
        Guid postId,
        IEnumerable<Guid>? mediaIds,
        CancellationToken cancellationToken)
    {
        var ids = (mediaIds ?? []).Distinct().ToArray();
        if (ids.Length == 0)
            return 0;

        var assets = await db.MediaAssets
            .Where(asset => asset.PostId == postId && asset.Status == "ACTIVE" && ids.Contains(asset.Id))
            .ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        foreach (var asset in assets)
        {
            asset.Status = "DELETED";
            asset.UpdatedAt = now;
        }

        return assets.Count;
    }

    /// <summary>
    /// 後台預覽用：QMAH.Web 的 /media 路徑刻意不公開社群上傳檔，改由受權限保護的 action 讀檔。
    /// 路徑超出媒體根目錄時回傳 null。
    /// </summary>
    public string? TryResolveExistingFile(string storedPath)
    {
        try
        {
            var path = ResolvePhysicalPath(mediaPaths.PublicRoot, storedPath);
            return File.Exists(path) ? path : null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    private static string ResolvePhysicalPath(string root, string relativePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
        var rootWithSeparator = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("媒體檔案路徑超出設定的儲存根目錄。");
        return fullPath;
    }

    private static List<IFormFile> NonEmpty(IEnumerable<IFormFile>? files) =>
        (files ?? []).Where(file => file is { Length: > 0 }).ToList();

    private static string DisplayName(IFormFile file) =>
        string.IsNullOrWhiteSpace(file.FileName) ? "圖片" : Path.GetFileName(file.FileName);

    private static string TruncateFileName(string? fileName)
    {
        var normalized = string.IsNullOrWhiteSpace(fileName) ? "image" : Path.GetFileName(fileName).Trim();
        return normalized.Length <= 260 ? normalized : normalized[..260];
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            // 清理失敗不可蓋掉原本的儲存錯誤。
        }
    }

    // 以檔案內容的 magic bytes 判斷格式，不信任副檔名或瀏覽器送來的 Content-Type（規則同 API）。
    private static async Task<ImageSignature?> ReadImageSignatureAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var input = file.OpenReadStream();
        var header = new byte[12];
        var read = 0;
        while (read < header.Length)
        {
            var count = await input.ReadAsync(header.AsMemory(read, header.Length - read), cancellationToken);
            if (count == 0)
                break;
            read += count;
        }

        if (read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return new ImageSignature(".jpg", "image/jpeg");
        if (read >= 8
            && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
            && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return new ImageSignature(".png", "image/png");
        if (read >= 6
            && header[0] == (byte)'G' && header[1] == (byte)'I' && header[2] == (byte)'F'
            && header[3] == (byte)'8' && (header[4] == (byte)'7' || header[4] == (byte)'9') && header[5] == (byte)'a')
            return new ImageSignature(".gif", "image/gif");
        if (read >= 12
            && header[0] == (byte)'R' && header[1] == (byte)'I' && header[2] == (byte)'F' && header[3] == (byte)'F'
            && header[8] == (byte)'W' && header[9] == (byte)'E' && header[10] == (byte)'B' && header[11] == (byte)'P')
            return new ImageSignature(".webp", "image/webp");

        return null;
    }

    private readonly record struct ImageSignature(string Extension, string ContentType);
}
