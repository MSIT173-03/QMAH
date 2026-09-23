namespace QMAH.Web.Areas.Social.Models;

public sealed class CommentAdminPageViewModel
{
    public string? Status { get; set; }

    public Guid? PostId { get; set; }

    public string? Keyword { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;

    public int TotalCount { get; set; }

    public int TotalPages => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)PageSize));

    public IReadOnlyList<AdminCommentListViewModel> Comments { get; set; } = [];
}
