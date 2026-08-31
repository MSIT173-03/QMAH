using System;
using System.Collections.Generic;

namespace QMAH.Infrastructure.Models.Entities;

public partial class KeyDefinition
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string ScopeType { get; set; } = null!;

    public Guid? CategoryId { get; set; }

    public Guid? EraBucketId { get; set; }

    public bool IsActive { get; set; }

    public virtual ArtifactCategory? Category { get; set; }

    public virtual EraBucket? EraBucket { get; set; }

    public virtual ICollection<KeyTransaction> KeyTransactions { get; set; } = new List<KeyTransaction>();

    public virtual ICollection<UserKeyBalance> UserKeyBalances { get; set; } = new List<UserKeyBalance>();
}