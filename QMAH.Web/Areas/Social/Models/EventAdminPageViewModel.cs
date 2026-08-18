namespace QMAH.Web.Areas.Social.Models;

public sealed class EventAdminPageViewModel
{
    public string? ReviewStatus { get; set; }

    public string? PublishStatus { get; set; }

    public int TotalCount { get; set; }

    public IReadOnlyList<EventListViewModel> Events { get; set; } = [];
}
