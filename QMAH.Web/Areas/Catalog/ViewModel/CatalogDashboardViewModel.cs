namespace QMAH.Web.Areas.Catalog.ViewModel;

public sealed class CatalogDashboardViewModel
{
    public int ArtifactCount { get; init; }

    public int ActiveArtifactCount { get; init; }

    public int CategoryCount { get; init; }

    public int EraBucketCount { get; init; }

    public int KeyDefinitionCount { get; init; }

    public int UnlockCount { get; init; }

    public IReadOnlyList<CatalogBreakdownItemViewModel> CategoryBreakdown { get; init; } = [];

    public IReadOnlyList<CatalogBreakdownItemViewModel> EraBreakdown { get; init; } = [];

    public IReadOnlyList<CatalogBreakdownItemViewModel> KeyScopeBreakdown { get; init; } = [];

    public IReadOnlyList<CatalogRecentUnlockViewModel> RecentUnlocks { get; init; } = [];
}

public sealed class CatalogBreakdownItemViewModel
{
    public string Name { get; init; } = "";
    public int Count { get; init; }
    public int ActiveCount { get; init; }
}

public sealed class CatalogRecentUnlockViewModel
{
    public string ArtifactName { get; init; } = "";
    public string UnlockMethod { get; init; } = "";
    public DateTime UnlockedAt { get; init; }
}
