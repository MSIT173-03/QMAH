namespace QMAH.Web.Areas.Social.Services;

/// <summary>
/// 後台直接變更貼文／留言可見狀態時，給作者的通知文字（貼文處理、留言管理共用）。
/// 只負責產生文字；是否發送、寫入哪個 DbContext 由呼叫端決定。
/// </summary>
public static class ContentStatusNotification
{
    public static (string Title, string Content)? ForPost(string title, string previousStatus, string newStatus) =>
        Build("貼文", $"「{Truncate(title, 30)}」", previousStatus, newStatus);

    public static (string Title, string Content)? ForComment(string content, string previousStatus, string newStatus) =>
        Build("留言", $"「{Truncate(content, 30)}」", previousStatus, newStatus);

    private static (string Title, string Content)? Build(
        string targetLabel,
        string summary,
        string previousStatus,
        string newStatus) =>
        (previousStatus, newStatus) switch
        {
            ("PUBLISHED", "HIDDEN") => ("你的內容已被隱藏", $"你的{targetLabel}{summary}經管理員檢視後已被隱藏。"),
            ("PUBLISHED", "DELETED") => ("你的內容已被移除", $"你的{targetLabel}{summary}經管理員檢視後已被移除。"),
            ("HIDDEN" or "DELETED", "PUBLISHED") => ("你的內容已恢復公開", $"你的{targetLabel}{summary}經管理員重新檢視後已恢復公開。"),
            // HIDDEN ↔ DELETED 對作者來說都是「看不到」，不另外通知。
            _ => null
        };

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "…";
}
