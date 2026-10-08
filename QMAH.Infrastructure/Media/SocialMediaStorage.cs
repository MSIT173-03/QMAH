using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Media;

/// <summary>
/// 社群圖片的資料夾規則：每篇貼文一個專屬資料夾，不再把檔案直接丟在媒體根目錄。
/// <code>
/// social/pending/{SequenceNo}.ext              已上傳但還沒送出貼文／留言的暫存圖片
/// social/posts/{postId}/{SequenceNo}.ext       貼文（含活動貼文）的圖片
/// social/posts/{postId}/comments/{SequenceNo}.ext   該貼文底下留言的附圖
/// </code>
/// MediaAssets.StoredPath 保存相對於媒體根目錄、以 / 分隔的路徑；以 / 開頭的舊資料（例如 /media/catalog/…）屬於其他來源，不會被搬動。
/// </summary>
public static class SocialMediaStorage
{
    public const string PendingFolder = "social/pending";

    public static string PostFolder(Guid postId) => $"social/posts/{postId:D}";

    public static string CommentFolder(Guid postId) => $"{PostFolder(postId)}/comments";

    /// <summary>
    /// 把已存在的圖片檔搬進指定資料夾並更新 StoredPath（只改實體物件，呼叫端自行 SaveChanges）。
    /// 搬不動（檔案不存在、被占用）時保持原樣並回傳 false，圖片仍可從原路徑讀取。
    /// </summary>
    public static bool TryRelocate(string root, MediaAsset asset, string folder)
    {
        if (asset.StoredPath.StartsWith('/') || asset.StoredPath.StartsWith(folder + "/", StringComparison.Ordinal))
            return false;

        try
        {
            var fullRoot = Path.GetFullPath(root);
            var source = Path.GetFullPath(Path.Combine(fullRoot, asset.StoredPath));
            var targetRelative = $"{folder}/{Path.GetFileName(asset.StoredPath)}";
            var target = Path.GetFullPath(Path.Combine(fullRoot, targetRelative));
            var prefix = fullRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!source.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                || !target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                || !File.Exists(source))
                return false;

            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Move(source, target, overwrite: false);
            asset.StoredPath = targetRelative;
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}
