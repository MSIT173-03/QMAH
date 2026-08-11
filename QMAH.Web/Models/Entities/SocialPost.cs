using System;
using System.Collections.Generic;

namespace QMAH.Web.Models.Entities;

public partial class SocialPost
{
    public Guid Id { get; set; }

    public string BoardCode { get; set; } = null!;

    public Guid UserId { get; set; }

    public Guid? ArtifactId { get; set; }

    public string Title { get; set; } = null!;

    public string Content { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<SocialComment> SocialComments { get; set; } = new List<SocialComment>();
}