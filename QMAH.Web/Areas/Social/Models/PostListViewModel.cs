using System;

namespace QMAH.Web.Areas.Social.Models
{
    public class PostListViewModel
    {
        public Guid Id { get; set; }
        public string BoardCode { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty; // 👈 接收發文者暱稱
        public Guid? ArtifactId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}