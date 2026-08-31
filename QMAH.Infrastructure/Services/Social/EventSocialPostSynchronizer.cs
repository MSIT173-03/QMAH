using System.Globalization;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 將獨立活動同步成一篇社群活動貼文，讓活動在沒有專屬前台頁面時仍有可見入口。
/// </summary>
public static class EventSocialPostSynchronizer
{
    public const string TemplateMode = "TEMPLATE";
    public const string CustomMode = "CUSTOM";

    public static SocialPost Create(
        Event eventData,
        Guid creatorUserId,
        DateTime now,
        string? contentMode = null,
        string? customTitle = null,
        string? customContent = null)
    {
        var post = new SocialPost
        {
            Id = Guid.NewGuid(),
            EventId = eventData.Id,
            BoardCode = "EVENT",
            PostType = "EVENT",
            PublisherType = eventData.EventType == "OFFICIAL" ? "OFFICIAL" : "COMMUNITY",
            ContentMode = NormalizeMode(contentMode, customContent),
            UserId = creatorUserId,
            Title = eventData.Title.Trim(),
            Content = BuildContent(eventData),
            LocationName = string.IsNullOrWhiteSpace(eventData.Location) ? null : eventData.Location.Trim(),
            Latitude = eventData.Latitude,
            Longitude = eventData.Longitude,
            Status = "HIDDEN",
            CreatedAt = now,
            UpdatedAt = now
        };

        ApplyContent(post, eventData, post.ContentMode, customTitle, customContent);
        return post;
    }

    public static void ApplyContent(
        SocialPost post,
        Event eventData,
        string? contentMode,
        string? customTitle,
        string? customContent)
    {
        post.BoardCode = "EVENT";
        post.PostType = "EVENT";
        post.PublisherType = eventData.EventType == "OFFICIAL" ? "OFFICIAL" : "COMMUNITY";
        post.ContentMode = NormalizeMode(contentMode, customContent);
        post.Title = post.ContentMode == CustomMode && !string.IsNullOrWhiteSpace(customTitle)
            ? customTitle.Trim()
            : eventData.Title.Trim();
        post.Content = post.ContentMode == CustomMode && !string.IsNullOrWhiteSpace(customContent)
            ? customContent.Trim()
            : BuildContent(eventData);
        post.LocationName = string.IsNullOrWhiteSpace(eventData.Location) ? null : eventData.Location.Trim();
        post.Latitude = eventData.Latitude;
        post.Longitude = eventData.Longitude;
        post.UpdatedAt = DateTime.UtcNow;
    }

    public static void SyncPublication(SocialPost post, Event eventData, DateTime now)
    {
        post.Status = eventData.ReviewStatus == "APPROVED" && eventData.PublishStatus == "PUBLISHED"
            ? "PUBLISHED"
            : "HIDDEN";
        post.UpdatedAt = now;
    }

    private static string NormalizeMode(string? contentMode, string? customContent) =>
        string.Equals(contentMode?.Trim(), CustomMode, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(customContent)
            ? CustomMode
            : TemplateMode;

    private static string BuildContent(Event eventData)
    {
        var location = string.IsNullOrWhiteSpace(eventData.Location)
            ? "地點待補充"
            : eventData.Location.Trim();
        var capacity = eventData.Capacity.HasValue
            ? $"限額：{eventData.Capacity.Value} 人"
            : "限額：不限人數";

        return $"{eventData.Content.Trim()}\n\n活動資訊\n時間：{FormatDate(eventData.StartAt)} 至 {FormatDate(eventData.EndAt)}\n地點：{location}\n{capacity}";
    }

    private static string FormatDate(DateTime value) =>
        value.ToString("yyyy/MM/dd HH:mm", CultureInfo.InvariantCulture);
}
