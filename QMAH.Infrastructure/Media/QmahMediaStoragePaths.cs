using Microsoft.Extensions.Configuration;

namespace QMAH.Infrastructure.Media;

/// <summary>API 與 Web 共用的實體媒體目錄；公開網址仍由 QmahMediaUrlResolver 處理。</summary>
public sealed record QmahMediaStoragePaths(
    string PublicRoot,
    AvatarStoragePaths Avatars,
    string PresetAvatarRoot,
    string ImageRoot,
    string FontRoot,
    string AchievementRoot,
    string FaviconPath)
{
    public static QmahMediaStoragePaths Resolve(IConfiguration configuration, string contentRootPath)
    {
        var legacyWebRoot = Path.GetFullPath(Path.Combine(contentRootPath, "..", "QMAH.Web", "wwwroot"));
        var assetRoot = GetFullPath(contentRootPath,
            configuration["Media:AssetRootPath"] is { Length: > 0 } configured
                ? configured.Trim() : Path.Combine("..", "QMAH.Media"));
        var publicRoot = ResolveRoot(configuration["Media:RootPath"], contentRootPath,
            Path.Combine(assetRoot, "media"), Path.Combine(legacyWebRoot, "media"));
        var avatars = new AvatarStoragePaths(ResolveRoot(configuration["Avatar:RootPath"], contentRootPath,
            Path.Combine(assetRoot, "uploads", "avatars"),
            Path.Combine(legacyWebRoot, "uploads", "avatars")));
        var presetRoot = ResolveRoot(configuration["Avatar:PresetRootPath"], contentRootPath,
            Path.Combine(assetRoot, "images", "avatars"),
            Path.Combine(legacyWebRoot, "images", "avatars"));
        var images = ResolveRoot(null, contentRootPath, Path.Combine(assetRoot, "images"),
            Path.Combine(legacyWebRoot, "images"));
        var fonts = ResolveRoot(null, contentRootPath, Path.Combine(assetRoot, "fonts"),
            Path.Combine(legacyWebRoot, "fonts"));
        var achievements = ResolveRoot(configuration["Achievement:RootPath"], contentRootPath,
            Path.Combine(assetRoot, "uploads", "achievements"),
            Path.Combine(legacyWebRoot, "uploads", "achievements"));
        var favicon = File.Exists(Path.Combine(assetRoot, "favicon.ico"))
            ? Path.Combine(assetRoot, "favicon.ico") : Path.Combine(legacyWebRoot, "favicon.ico");
        return new QmahMediaStoragePaths(publicRoot, avatars, presetRoot, images, fonts, achievements, favicon);
    }

    private static string ResolveRoot(string? configured, string contentRoot, string defaultPath, string legacyPath)
    {
        var current = GetFullPath(contentRoot, defaultPath);
        var legacy = GetFullPath(contentRoot, legacyPath);
        if (string.IsNullOrWhiteSpace(configured))
            return Directory.Exists(current) || !Directory.Exists(legacy) ? current : legacy;

        var selected = GetFullPath(contentRoot, configured.Trim());
        // 舊的 Local 設定若只指向已搬空的 wwwroot，沿用新目錄；自訂路徑仍照設定使用。
        if (string.Equals(selected, legacy,
                OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)
            && Directory.Exists(current)
            && (!Directory.Exists(legacy) || !Directory.EnumerateFileSystemEntries(legacy).Any()))
            return current;
        return selected;
    }

    private static string GetFullPath(string contentRoot, string path) =>
        Path.GetFullPath(Path.IsPathRooted(path) ? path : Path.Combine(contentRoot, path));
}
