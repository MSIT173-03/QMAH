namespace QMAH.Web.Areas.Social.Models
{
    public class EventListViewModel
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED
        public DateTime CreatedAt { get; set; }
    }
}