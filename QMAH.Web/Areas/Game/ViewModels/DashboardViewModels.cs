namespace QMAH.Web.Areas.Game.ViewModels;

public sealed class GameDashboardViewModel
{
    public int EnabledQuestionCount { get; init; }

    public int TotalQuestionCount { get; init; }

    public int DisabledQuestionCount => Math.Max(0, TotalQuestionCount - EnabledQuestionCount);

    public int WaitingRoomCount { get; init; }

    public int PlayingRoomCount { get; init; }

    public int OnlinePlayerCount { get; init; }

    public int CompletedRoomCount { get; init; }

    public int RoundCount { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }

    public IReadOnlyList<DashboardRoomItemViewModel> RecentRooms { get; init; } = [];

    public IReadOnlyList<DashboardRoundItemViewModel> RecentRounds { get; init; } = [];

    public IReadOnlyList<DashboardPlayerItemViewModel> RecentPlayers { get; init; } = [];

    public IReadOnlyList<DashboardDifficultyItemViewModel> DifficultyDistribution { get; init; } = [];
}

public sealed class DashboardRoomItemViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public required string Status { get; init; }

    public required string Visibility { get; init; }

    public int PlayerCount { get; init; }

    public int RoundCount { get; init; }

    public DateTime CreatedAt { get; init; }
}

public sealed class DashboardRoundItemViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string ArtifactName { get; init; }

    public required string Status { get; init; }

    public DateTime StartedAt { get; init; }
}

public sealed class DashboardPlayerItemViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public required string DisplayName { get; init; }

    public required string ConnectionStatus { get; init; }

    public DateTime JoinedAt { get; init; }
}

public sealed class DashboardDifficultyItemViewModel
{
    public byte Difficulty { get; init; }

    public int Count { get; init; }

    public int EnabledCount { get; init; }
}
