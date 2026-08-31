using System;
using System.Collections.Generic;

namespace QMAH.Infrastructure.Models.Entities;

public partial class EventRegistration
{
    public Guid Id { get; set; }

    public Guid EventId { get; set; }

    public Guid UserId { get; set; }

    public string Status { get; set; } = null!;

    public DateTime RegisteredAt { get; set; }

    public virtual Event Event { get; set; } = null!;
}