using System;
using System.Collections.Generic;

using QMAH.Web.Models.Identity;

namespace QMAH.Web.Models.Entities;

public partial class UserAchievement
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid AchievementId { get; set; }

    public DateTime AchievedAt { get; set; }

    public bool IsDisplayed { get; set; }

    public DateTime? DisplayedAt { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public virtual Achievement Achievement { get; set; } = null!;

    public virtual ApplicationUser User { get; set; } = null!;
}