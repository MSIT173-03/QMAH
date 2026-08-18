namespace QMAH.Web.Areas.Social.Models
{
    public class AdminPostListViewModel
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string BoardCode { get; set; } = string.Empty;
        public string Status { get; set; } = "NORMAL"; // NORMAL, HIDDEN, DELETED
        public int CommentCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}