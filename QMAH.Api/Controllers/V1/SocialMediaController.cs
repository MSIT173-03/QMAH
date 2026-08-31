using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using QMAH.Api.Infrastructure.Media;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/social/media")]
public sealed class SocialMediaController(
    QmahDbContext db,
    IOptions<MediaStorageOptions> storageOptions) : ApiControllerBase
{
    private const long MaxFileSize = 8 * 1024 * 1024;

    [Authorize]
    [HttpPost]
    [RequestSizeLimit(MaxFileSize + (64 * 1024))]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxFileSize + (64 * 1024))]
    public async Task<ActionResult<SocialMediaDto>> Upload(
        [FromForm] IFormFile? file,
        [FromForm] string? altText,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (file is null || file.Length <= 0)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "請選擇圖片", detail: "上傳內容必須包含一個圖片檔案。");
        if (file.Length > MaxFileSize)
            return Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "圖片過大", detail: "單一圖片不可超過 8 MB。");
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();

        var signature = await ReadImageSignatureAsync(file, cancellationToken);
        if (signature is null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "圖片格式不支援",
                detail: "只接受內容確實符合 JPEG、PNG、GIF 或 WebP 格式的圖片。");
        }

        var now = DateTime.UtcNow;
        var asset = new MediaAsset
        {
            Id = Guid.NewGuid(),
            OwnerUserId = userId,
            OriginalFileName = TruncateFileName(Path.GetFileName(file.FileName)),
            // 先用狀態值取得資料庫流水號，再以流水號作為單層資料夾中的可讀檔名。
            StoredPath = "pending",
            ContentType = signature.Value.ContentType,
            FileSize = file.Length,
            AltText = string.IsNullOrWhiteSpace(altText) ? null : altText.Trim(),
            Status = "HIDDEN",
            CreatedAt = now,
            UpdatedAt = now
        };
        if (asset.AltText?.Length > 200)
            asset.AltText = asset.AltText[..200];

        db.MediaAssets.Add(asset);
        await db.SaveChangesAsync(cancellationToken);

        var storedFileName = $"{asset.SequenceNo}{signature.Value.Extension}";
        var physicalPath = ResolvePhysicalPath(storedFileName);
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
            return CreatedAtAction(nameof(GetContent), new { id = asset.Id }, ToDto(asset));
        }
        catch
        {
            TryDeleteFile(physicalPath);
            asset.Status = "DELETED";
            asset.UpdatedAt = DateTime.UtcNow;
            try
            {
                await db.SaveChangesAsync(CancellationToken.None);
            }
            catch
            {
                // 清理狀態失敗時仍保留原始上傳例外，避免洩漏內部資料庫資訊。
            }
            throw;
        }
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/content")]
    public async Task<IActionResult> GetContent(Guid id, CancellationToken cancellationToken = default)
    {
        var asset = await db.MediaAssets
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id && item.Status == "ACTIVE", cancellationToken);
        if (asset is null)
            return NotFound();

        var isPublishedPostAsset = asset.PostId.HasValue
            && await db.SocialPosts.AnyAsync(
                post => post.Id == asset.PostId.Value && post.Status == "PUBLISHED",
                cancellationToken);
        var isOwner = TryGetCurrentUserId(out var userId) && userId == asset.OwnerUserId;
        if (!isPublishedPostAsset && !isOwner)
            return NotFound();

        var physicalPath = ResolvePhysicalPath(asset.StoredPath);
        if (!System.IO.File.Exists(physicalPath))
            return NotFound();

        return PhysicalFile(physicalPath, asset.ContentType, enableRangeProcessing: true);
    }

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var asset = await db.MediaAssets
            .SingleOrDefaultAsync(item => item.Id == id && item.OwnerUserId == userId, cancellationToken);
        if (asset is null)
            return NotFound();
        if (asset.Status == "DELETED")
            return NoContent();

        // 只做軟刪除，保留貼文與稽核關聯；實體檔案由後續清理流程處理。
        asset.Status = "DELETED";
        asset.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<bool> IsActiveUserAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken);

    private async Task<ImageSignature?> ReadImageSignatureAsync(
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

    private string ResolvePhysicalPath(string relativePath)
    {
        var root = Path.GetFullPath(storageOptions.Value.RootPath);
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
        var rootWithSeparator = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("媒體檔案路徑超出設定的儲存根目錄。");
        return fullPath;
    }

    private static SocialMediaDto ToDto(MediaAsset asset) => new(
        asset.Id,
        $"/api/v1/social/media/{asset.Id:D}/content",
        asset.AltText,
        asset.ContentType,
        asset.FileSize,
        asset.CreatedAt);

    private static string TruncateFileName(string? fileName)
    {
        var normalized = string.IsNullOrWhiteSpace(fileName) ? "image" : Path.GetFileName(fileName).Trim();
        return normalized.Length <= 260 ? normalized : normalized[..260];
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);
        }
        catch
        {
            // Cleanup failure must not mask the original upload/database exception.
        }
    }

    private readonly record struct ImageSignature(string Extension, string ContentType);
}
