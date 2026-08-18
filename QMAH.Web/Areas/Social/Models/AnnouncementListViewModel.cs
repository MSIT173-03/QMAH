namespace QMAH.Web.Areas.Social.Models
{
    /// <summary>
    /// 後台官方公告列表頁 ViewModel
    /// </summary>
    public class AnnouncementListViewModel
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime? PublishAt { get; set; }
        public DateTime? EndAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
    }
}