using System;

namespace QMAH.Infrastructure.Models.Entities;

/// <summary>會員收藏的貼文；複合主鍵 (UserId, PostId)，同一篇只能收藏一次。</summary>
public partial class PostBookmark
{
    public Guid UserId { get; set; }

    public Guid PostId { get; set; }

    public DateTime CreatedAt { get; set; }
}
