namespace QMAH.Api.Controllers.V1;

public sealed record GameRehearsalAnswerDto(string AnswerType, string Text);
public sealed record GameRehearsalMaterialDto(Guid ArtifactId, string ArtifactName, string? PrimaryImagePath, string? ThumbnailPath, IReadOnlyList<GameRehearsalAnswerDto> Answers);
public sealed record GameRehearsalSessionDto(IReadOnlyList<GameRehearsalMaterialDto> Materials, IReadOnlyList<string> PlayerNames, string CurrentPlayerName);
public sealed record GameRehearsalRoomDto(string Id, string RoomCode, string Status, string Visibility, int MaxPlayers, int TotalRounds, int PlayerCount, string? CategoryFilterCode, string? EraBucketFilterCode, DateTime CreatedAt);
