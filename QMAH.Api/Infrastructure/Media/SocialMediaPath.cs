namespace QMAH.Api.Infrastructure.Media;

public static class SocialMediaPath
{
    /// <summary>Resolve uploads and legacy /media/... references inside the configured root.</summary>
    public static bool TryResolve(string rootPath, string? storedPath, out string physicalPath)
    {
        physicalPath = string.Empty;
        if (string.IsNullOrWhiteSpace(storedPath)) return false;
        var relative = storedPath.Replace('\\', '/');
        // Only this known public prefix is a legacy URL, not an absolute file path.
        if (relative.StartsWith("/media/", StringComparison.Ordinal))
            relative = relative["/media/".Length..];
        if (relative.Length == 0 || relative.StartsWith('/') || relative.Contains(':')
            || relative.Split('/').Any(segment => segment is ".." or "."))
            return false;
        try
        {
            var root = Path.GetFullPath(rootPath);
            var candidate = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
            var prefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            if (!candidate.StartsWith(prefix, comparison)) return false;
            physicalPath = candidate;
            return true;
        }
        catch (Exception exception) when (exception is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return false;
        }
    }
}
