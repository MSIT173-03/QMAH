using System.ComponentModel.DataAnnotations;

namespace QMAH.Api.Controllers.V1;

/// <summary>前端建立 Mini Game 流程所需的模式識別、說明與評分門檻。</summary>
public sealed record MiniGameModeDto(
    Guid Id,
    string Code,
    string Name,
    string Description,
    string? ConfigJson,
    int GradeBThreshold,
    int GradeAThreshold,
    int GradeSThreshold);

/// <summary>開始 Mini Game 後由伺服器決定並回傳的素材、難度、種子與設定。</summary>
public sealed record MiniGameStartDto(
    Guid AttemptId,
    string ModeCode,
    string ModeName,
    Guid ArtifactId,
    string ArtifactName,
    string PrimaryImagePath,
    string? ThumbnailPath,
    IReadOnlyList<MiniGameArtifactDto> ArtifactPool,
    string Difficulty,
    string Seed,
    string? ConfigJson,
    DateTime StartedAt);

/// <summary>Mini Game 素材池中的單件文物與可供前端載入的圖片路徑。</summary>
public sealed record MiniGameArtifactDto(
    Guid ArtifactId,
    string Name,
    string PrimaryImagePath,
    string? ThumbnailPath);

/// <summary>開始指定 Mini Game 模式的請求。</summary>
public sealed class StartMiniGameRequest
{
    [Required, StringLength(40, MinimumLength = 1)]
    public string ModeCode { get; set; } = "";
}

/// <summary>完成 Mini Game 時送出的原始分數與可供伺服器驗證的結果資料。</summary>
public sealed class CompleteMiniGameRequest
{
    [Range(0, 100)]
    public int RawScore { get; set; }

    public string? RawResultJson { get; set; }
}

/// <summary>Mini Game 完成後由伺服器計算的分數、等級、點數與鑰匙進度。</summary>
public sealed record MiniGameCompleteDto(
    Guid AttemptId,
    string ModeCode,
    int RawScore,
    int NormalizedScore,
    string Grade,
    int PointReward,
    int KeyProgressReward,
    int ConvertedNormalKeys,
    int RemainingKeyProgress,
    bool EconomicRewardGranted,
    bool AlreadyCompleted,
    DateTime CompletedAt);

/// <summary>多人主遊戲單一會員的獎勵結算結果。</summary>
public sealed record MainGameRewardDto(
    int PointReward,
    int NormalKeyReward,
    int PerformanceScore,
    int RoundsWon,
    bool AlreadyRewarded);
