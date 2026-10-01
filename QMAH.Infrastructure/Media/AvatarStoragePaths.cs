namespace QMAH.Infrastructure.Media;

/// <summary>會員頭像實體目錄；資料庫仍保存 /uploads/avatars 開頭的公開路徑。</summary>
public sealed record AvatarStoragePaths(string RootPath)
{
    /// <summary>新頭像依會員分目錄；舊的 /uploads/avatars/檔名 網址仍可直接讀取。</summary>
    public (string FilePath, string PublicPath) CreateUploadTarget(Guid userId, string extension)
    {
        var userFolder = Path.Combine(RootPath, userId.ToString("N"));
        Directory.CreateDirectory(userFolder);
        var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}{extension}";
        return (Path.Combine(userFolder, fileName), $"/uploads/avatars/{userId:N}/{fileName}");
    }

    /// <summary>指定路徑優先；未指定時才讀取會員目錄中最新上傳的頭像。</summary>
    public string? ResolvePublicPath(Guid userId, string? specifiedPath)
    {
        if (!string.IsNullOrWhiteSpace(specifiedPath))
            return specifiedPath;

        var userFolder = Path.Combine(RootPath, userId.ToString("N"));
        if (!Directory.Exists(userFolder))
            return null;

        var latest = Directory.EnumerateFiles(userFolder)
            .Where(path => new[] { ".jpg", ".jpeg", ".png", ".webp" }
                .Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(Path.GetFileName, StringComparer.Ordinal)
            .FirstOrDefault();
        return latest is null ? null : $"/uploads/avatars/{userId:N}/{Path.GetFileName(latest)}";
    }
}
