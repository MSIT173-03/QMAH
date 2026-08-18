namespace QMAH.Web.Areas.Social.Models;

public sealed class SocialPostAdminPageViewModel
{
    public string? Keyword { get; set; }

    public string? BoardCode { get; set; }

    public string? Status { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    public int TotalCount { get; set; }

    public IReadOnlyList<string> BoardCodes { get; set; } = [];

    public IReadOnlyList<AdminPostListViewModel> Posts { get; set; } = [];
}
