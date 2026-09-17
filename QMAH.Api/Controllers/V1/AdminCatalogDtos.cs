namespace QMAH.Api.Controllers.V1;

/// <summary>管理員強制解鎖文物的結果；Created 為 false 代表原本已解鎖。</summary>
public sealed record AdminArtifactUnlockDto(
    Guid UserId,
    Guid ArtifactId,
    bool Created,
    string UnlockMethod,
    DateTime UnlockedAt);
