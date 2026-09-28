namespace QMAH.Infrastructure.Media;

/// <summary>會員頭像實體目錄；資料庫仍保存 /uploads/avatars 開頭的公開路徑。</summary>
public sealed record AvatarStoragePaths(string RootPath)
{
    public static AvatarStoragePaths Resolve(string? configuredPath, string contentRootPath, string defaultPath)
    {
        var path = string.IsNullOrWhiteSpace(configuredPath) ? defaultPath : configuredPath.Trim();
        var root = Path.IsPathRooted(path)
            ? Path.GetFullPath(path)
            : Path.GetFullPath(Path.Combine(contentRootPath, path));
        return new AvatarStoragePaths(root);
    }
}
