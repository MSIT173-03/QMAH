using System;

namespace QMAH.Infrastructure.Models.Entities;

/// <summary>會員之間的一則私訊；對話由寄件與收件兩端組合出來。</summary>
public partial class DirectMessage
{
    public Guid Id { get; set; }

    public Guid SenderUserId { get; set; }

    public Guid RecipientUserId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    /// <summary>收件人讀取的時間；null 代表未讀。</summary>
    public DateTime? ReadAt { get; set; }
}
