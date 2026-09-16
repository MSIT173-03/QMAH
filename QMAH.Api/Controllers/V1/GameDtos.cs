using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

// Game API 契約集中在這裡，避免和會員、社群、商城 DTO 互相牽動。
public sealed record GameRoomListItemDto(
    Guid Id,
    string RoomCode,
    string Status,
    string Visibility,
    byte MaxPlayers,
    byte TotalRounds,
    int PlayerCount,
    string? CategoryFilterCode,
    string? EraBucketFilterCode,
    DateTime CreatedAt);

public sealed record GamePlayerDto(
    Guid Id,
    string DisplayName,
    string Role,
    bool IsReady,
    byte? SeatNo,
    string ConnectionStatus);

public sealed record GameRoomDetailsDto(
    Guid Id,
    string RoomCode,
    string Status,
    string Visibility,
    byte MaxPlayers,
    byte TotalRounds,
    short AnswerSeconds,
    short VotingSeconds,
    string? CategoryFilterCode,
    string? EraBucketFilterCode,
    byte CurrentRoundNo,
    Guid? CurrentRoundId,
    Guid? CurrentPlayerId,
    IReadOnlyList<GamePlayerDto> Players,
    DateTime CreatedAt,
    DateTime? StartedAt,
    DateTime? EndedAt);

public sealed record GameAnswerDto(
    Guid Id,
    Guid GamePlayerId,
    string PlayerDisplayName,
    string AnswerType,
    string Text,
    int VoteCount,
    int Rank,
    bool IsWinner,
    DateTime SubmittedAt);

public sealed record GameRoundDetailsDto(
    Guid Id,
    Guid RoomId,
    Guid CurrentPlayerId,
    IReadOnlyList<Guid> VotedAnswerIds,
    Guid ArtifactId,
    string ArtifactName,
    string? PrimaryImagePath,
    string? ThumbnailPath,
    int RoundNumber,
    string Status,
    bool IsSettled,
    DateTime StartedAt,
    DateTime AnswerDeadlineAt,
    DateTime VotingDeadlineAt,
    DateTime? SettledAt,
    int ParticipantCount,
    int TotalVoteCount,
    Guid? WinnerAnswerId,
    string? WinnerPlayerDisplayName,
    IReadOnlyList<GameAnswerDto> Answers);

public sealed record GameRoundSummaryDto(
    Guid Id,
    int RoundNumber,
    Guid ArtifactId,
    string ArtifactName,
    string Status,
    bool IsSettled,
    DateTime StartedAt,
    DateTime? SettledAt,
    int AnswerCount,
    int TotalVoteCount,
    Guid? WinnerAnswerId,
    string? WinnerPlayerDisplayName,
    IReadOnlyList<GameAnswerDto> Answers);

public sealed record GameLeaderboardItemDto(
    Guid GamePlayerId,
    string DisplayName,
    int Score,
    int RoundsAnswered,
    int RoundsWon,
    int Rank);

public sealed record GameRoomHistoryDto(
    Guid RoomId,
    string RoomCode,
    string Status,
    IReadOnlyList<GameRoundSummaryDto> Rounds,
    IReadOnlyList<GameLeaderboardItemDto> Leaderboard);

public sealed class CreateGameRoomRequest
{
    [Required, StringLength(20)]
    public string Visibility { get; set; } = "PUBLIC";

    [StringLength(128)]
    public string? Password { get; set; }

    [Required, StringLength(80, MinimumLength = 1)]
    public string DisplayName { get; set; } = "玩家";

    [Range(3, 10)]
    public byte MaxPlayers { get; set; } = 6;

    [Range(1, 5)]
    public byte TotalRounds { get; set; } = 3;

    [Range(30, 300)]
    public short AnswerSeconds { get; set; } = 120;

    [Range(20, 180)]
    public short VotingSeconds { get; set; } = 60;

    [StringLength(32)]
    public string? CategoryFilterCode { get; set; }

    [StringLength(32)]
    public string? EraBucketFilterCode { get; set; }
}

public sealed class JoinGameRoomRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public string DisplayName { get; set; } = "玩家";

    [StringLength(128)]
    public string? Password { get; set; }
}

public sealed class SetGamePlayerReadyRequest
{
    public bool IsReady { get; set; }
}

public sealed class SubmitAnswerRequest
{
    [Required, StringLength(32)]
    public string AnswerType { get; set; } = "";

    [Required, StringLength(500, MinimumLength = 1)]
    public string Text { get; set; } = "";
}

public sealed class SubmitVoteRequest
{
    [Required]
    public Guid AnswerId { get; set; }

    [Range(1, 3)]
    public int Count { get; set; } = 1;
}
