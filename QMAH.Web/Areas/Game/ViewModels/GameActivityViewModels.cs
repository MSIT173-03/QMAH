using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Game.ViewModels;

public sealed class PlayerIndexViewModel
{
    public string? Search { get; init; }

    public string? ConnectionStatus { get; init; }

    public string Sort { get; init; } = "joined";

    public int PageSize { get; init; } = 20;

    public required PagedResult<PlayerListItemViewModel> Results { get; init; }
}

public class PlayerListItemViewModel
{
    public Guid Id { get; init; }

    public Guid RoomId { get; init; }

    public required string RoomCode { get; init; }

    public required string DisplayName { get; init; }

    public string? UserName { get; init; }

    public string? Email { get; init; }

    public required string Role { get; init; }

    public required string ConnectionStatus { get; init; }

    public bool IsReady { get; init; }

    public byte? SeatNo { get; init; }

    public DateTime JoinedAt { get; init; }
}

public sealed class PlayerDetailsViewModel : PlayerListItemViewModel
{
    public required string PlayerKey { get; init; }

    public DateTime LastSeenAt { get; init; }

    public DateTime? DisconnectedAt { get; init; }

    public DateTime? ReconnectDeadlineAt { get; init; }

    public DateTime? LeftAt { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }
}

public sealed class RoundIndexViewModel
{
    public string? Search { get; init; }

    public string? Status { get; init; }

    public Guid? RoomId { get; init; }

    public string Sort { get; init; } = "started";

    public int PageSize { get; init; } = 20;

    public required PagedResult<RoundListItemViewModel> Results { get; init; }
}

public class RoundListItemViewModel
{
    public Guid Id { get; init; }

    public Guid RoomId { get; init; }

    public Guid ArtifactId { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string ArtifactName { get; init; }

    public required string Status { get; init; }

    public bool IsSettled { get; init; }

    public DateTime StartedAt { get; init; }

    public DateTime AnswerDeadlineAt { get; init; }

    public DateTime VotingDeadlineAt { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }
}

public sealed class RoundDetailsViewModel : RoundListItemViewModel
{
    public required string RowVersion { get; init; }

    public string? ArtifactRef { get; init; }

    public string? ImagePath { get; init; }

    public DateTime? SettledAt { get; init; }

    public int StateVersion { get; init; }

    public IReadOnlyList<AnswerListItemViewModel> Answers { get; init; } = [];
}

public sealed class AnswerIndexViewModel
{
    public string? Search { get; init; }

    public Guid? RoundId { get; init; }

    public string? AnswerType { get; init; }

    public string Sort { get; init; } = "submitted";

    public int PageSize { get; init; } = 20;

    public required PagedResult<AnswerListItemViewModel> Results { get; init; }
}

public class AnswerListItemViewModel
{
    public Guid Id { get; init; }

    public Guid RoundId { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string PlayerName { get; init; }

    public required string AnswerType { get; init; }

    public required string Text { get; init; }

    public DateTime SubmittedAt { get; init; }

    public int VoteCount { get; init; }
}

public sealed class AnswerDetailsViewModel : AnswerListItemViewModel
{
    public required string ArtifactName { get; init; }

    public IReadOnlyList<VoteListItemViewModel> Votes { get; init; } = [];
}

public sealed class VoteIndexViewModel
{
    public string? Search { get; init; }

    public Guid? RoundId { get; init; }

    public string Sort { get; init; } = "submitted";

    public int PageSize { get; init; } = 20;

    public required PagedResult<VoteListItemViewModel> Results { get; init; }
}

public class VoteListItemViewModel
{
    public Guid Id { get; init; }

    public Guid RoundId { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string VoterName { get; init; }

    public required string AnswerPlayerName { get; init; }

    public int Count { get; init; }

    public DateTime SubmittedAt { get; init; }
}

public sealed class VoteDetailsViewModel : VoteListItemViewModel
{
    public required string AnswerText { get; init; }

    public required string AnswerType { get; init; }
}
