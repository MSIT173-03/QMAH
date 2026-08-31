namespace QMAH.Web.Areas.Social.Models
{
    public class AdminPostListViewModel
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string AuthorName { get; set; } = string.Empty;
        public string BoardCode { get; set; } = string.Empty;
        public string PostType { get; set; } = "POST";
        public string PublisherType { get; set; } = "COMMUNITY";
        public Guid? EventId { get; set; }
        public string? LocationName { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public string Status { get; set; } = "NORMAL"; // NORMAL, HIDDEN, DELETED
        public int CommentCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
