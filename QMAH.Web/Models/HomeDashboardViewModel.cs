namespace QMAH.Web.Models;

public sealed class HomeDashboardViewModel
{
    public int ArtifactCount { get; init; }

    public int ActiveArtifactCount { get; init; }

    public int PublishedPostCount { get; init; }

    public int ActiveEventCount { get; init; }

    public int MemberCount { get; init; }

    public int ActiveMemberCount { get; init; }

    public int ProductCount { get; init; }

    public int ActiveProductCount { get; init; }

    public bool IsAuthenticated { get; init; }

    public bool IsAdmin { get; init; }

    public string MemberDisplayName { get; init; } = "會員";
}
