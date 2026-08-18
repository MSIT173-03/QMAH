namespace QMAH.Web.Areas.Social.Models;

public sealed class SocialDashboardViewModel
{
    public int PublishedPostCount { get; init; }

    public int CommentCount { get; init; }

    public int PendingReportCount { get; init; }

    public int PendingEventCount { get; init; }

    public int PublishedEventCount { get; init; }

    public int PublishedAnnouncementCount { get; init; }

    public IReadOnlyList<SocialDashboardPostItem> RecentPosts { get; init; } = [];
}

public sealed class SocialDashboardPostItem
{
    public Guid Id { get; init; }

    public string BoardCode { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public DateTime CreatedAt { get; init; }
}
