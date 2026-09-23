namespace QMAH.Web.Areas.Social.Models;

public sealed class AdminCommentListViewModel
{
    public Guid Id { get; set; }

    public Guid PostId { get; set; }

    public string PostTitle { get; set; } = string.Empty;

    public Guid? ParentCommentId { get; set; }

    public Guid UserId { get; set; }

    public string AuthorName { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string Status { get; set; } = "PUBLISHED"; // PUBLISHED, HIDDEN, DELETED

    public DateTime CreatedAt { get; set; }
}
