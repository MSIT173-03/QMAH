namespace QMAH.Web.Areas.Social.Models;

public sealed class SocialPostAdminPageViewModel
{
    public string? Keyword { get; set; }

    public string? BoardCode { get; set; }

    public string? PostType { get; set; }

    public string? Status { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;

    public int TotalCount { get; set; }

    public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)PageSize));

    public IReadOnlyList<string> BoardCodes { get; set; } = [];

    public IReadOnlyList<string> PostTypes { get; set; } = ["POST", "ANNOUNCEMENT"];

    public IReadOnlyList<AdminPostListViewModel> Posts { get; set; } = [];
}
