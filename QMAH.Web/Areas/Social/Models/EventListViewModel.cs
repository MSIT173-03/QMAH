namespace QMAH.Web.Areas.Social.Models
{
    public class EventListViewModel
    {
        public Guid Id { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Location { get; set; }
        public DateTime StartAt { get; set; }
        public DateTime EndAt { get; set; }
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED
        public string PublishStatus { get; set; } = "DRAFT";
        public string? ReviewNote { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
