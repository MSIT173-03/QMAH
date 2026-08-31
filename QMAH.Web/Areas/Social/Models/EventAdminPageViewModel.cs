namespace QMAH.Web.Areas.Social.Models;

public sealed class EventAdminPageViewModel
{
    public string? ReviewStatus { get; set; }

    public string? PublishStatus { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;

    public int TotalCount { get; set; }

    public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)PageSize));

    public IReadOnlyList<EventListViewModel> Events { get; set; } = [];
}
