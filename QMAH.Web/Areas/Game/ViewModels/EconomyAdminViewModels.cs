using System.ComponentModel.DataAnnotations;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Game.ViewModels;

/// <summary>經濟設定與 Mini Game 模式管理頁的整體資料。</summary>
public sealed class GameEconomyPageViewModel
{
    public GameEconomyEditViewModel Economy { get; set; } = new();

    public IReadOnlyList<GameModeDefinition> Modes { get; set; } = [];
}

/// <summary>多人主遊戲與 Mini Game 共用的可調經濟參數表單。</summary>
public sealed class GameEconomyEditViewModel
{
    public byte Id { get; set; } = 1;

    [Range(0, 1_000_000, ErrorMessage = "最低點數獎勵必須介於 0 至 1,000,000。")]
    public int MinimumPointReward { get; set; } = 8;

    [Range(0, 1_000_000, ErrorMessage = "最高點數獎勵必須介於 0 至 1,000,000。")]
    public int MaximumPointReward { get; set; } = 20;

    [Range(0, 1_000_000, ErrorMessage = "基礎點數獎勵必須介於 0 至 1,000,000。")]
    public int BasePointReward { get; set; } = 8;

    [Range(0, 1_000_000, ErrorMessage = "投票加成上限必須介於 0 至 1,000,000。")]
    public int MaximumVoteBonus { get; set; } = 8;

    [Range(0, 1_000_000, ErrorMessage = "勝場加成上限必須介於 0 至 1,000,000。")]
    public int MaximumWinBonus { get; set; } = 4;

    [Range(0, 1_000_000, ErrorMessage = "完成獎勵鑰匙數必須介於 0 至 1,000,000。")]
    public int CompletedNormalKey { get; set; } = 1;

    [Range(0, 1_000_000, ErrorMessage = "額外鑰匙數必須介於 0 至 1,000,000。")]
    public int ExcellentExtraNormalKey { get; set; } = 1;

    [Range(0, 100, ErrorMessage = "優秀表現門檻必須介於 0 至 100。")]
    public int ExcellentThreshold { get; set; } = 80;

    [Range(0, 1_000, ErrorMessage = "每日 Mini Game 獎勵次數必須介於 0 至 1,000。")]
    public int DailyMiniGameRewardLimit { get; set; } = 5;

    [Range(1, 1_000_000, ErrorMessage = "鑰匙進度門檻必須大於 0。")]
    public int KeyProgressToNormalKey { get; set; } = 100;

    public byte[] RowVersion { get; set; } = [];

    /// <summary>將資料庫設定轉成避免直接繫結 Entity 的編輯模型。</summary>
    public static GameEconomyEditViewModel From(GameEconomySetting setting) => new()
    {
        Id = setting.Id,
        MinimumPointReward = setting.MinimumPointReward,
        MaximumPointReward = setting.MaximumPointReward,
        BasePointReward = setting.BasePointReward,
        MaximumVoteBonus = setting.MaximumVoteBonus,
        MaximumWinBonus = setting.MaximumWinBonus,
        CompletedNormalKey = setting.CompletedNormalKey,
        ExcellentExtraNormalKey = setting.ExcellentExtraNormalKey,
        ExcellentThreshold = setting.ExcellentThreshold,
        DailyMiniGameRewardLimit = setting.DailyMiniGameRewardLimit,
        KeyProgressToNormalKey = setting.KeyProgressToNormalKey,
        RowVersion = setting.RowVersion
    };
}

/// <summary>Mini Game 模式的評分門檻、獎勵與素材設定表單。</summary>
public sealed class GameModeEditViewModel
{
    public Guid Id { get; set; }

    [Required, StringLength(40, MinimumLength = 1)]
    public string Code { get; set; } = "";

    [Required, StringLength(100)]
    public string Name { get; set; } = "";

    [Required, StringLength(500)]
    public string Description { get; set; } = "";

    [StringLength(4_000)]
    public string? ConfigJson { get; set; }

    [Range(0, 100)]
    public int GradeBThreshold { get; set; } = 60;

    [Range(0, 100)]
    public int GradeAThreshold { get; set; } = 80;

    [Range(0, 100)]
    public int GradeSThreshold { get; set; } = 95;

    [Range(0, 1_000_000)]
    public int FailPointReward { get; set; }

    [Range(0, 1_000_000)]
    public int FailKeyProgressReward { get; set; }

    [Range(0, 1_000_000)]
    public int BPointReward { get; set; } = 1;

    [Range(0, 1_000_000)]
    public int BKeyProgressReward { get; set; } = 3;

    [Range(0, 1_000_000)]
    public int APointReward { get; set; } = 2;

    [Range(0, 1_000_000)]
    public int AKeyProgressReward { get; set; } = 6;

    [Range(0, 1_000_000)]
    public int SPointReward { get; set; } = 3;

    [Range(0, 1_000_000)]
    public int SKeyProgressReward { get; set; } = 10;

    public bool IsActive { get; set; } = true;

    public byte[] RowVersion { get; set; } = [];

    /// <summary>將資料庫模式轉成編輯表單模型。</summary>
    public static GameModeEditViewModel From(GameModeDefinition mode) => new()
    {
        Id = mode.Id,
        Code = mode.Code,
        Name = mode.Name,
        Description = mode.Description,
        ConfigJson = mode.ConfigJson,
        GradeBThreshold = mode.GradeBThreshold,
        GradeAThreshold = mode.GradeAThreshold,
        GradeSThreshold = mode.GradeSThreshold,
        FailPointReward = mode.FailPointReward,
        FailKeyProgressReward = mode.FailKeyProgressReward,
        BPointReward = mode.BPointReward,
        BKeyProgressReward = mode.BKeyProgressReward,
        APointReward = mode.APointReward,
        AKeyProgressReward = mode.AKeyProgressReward,
        SPointReward = mode.SPointReward,
        SKeyProgressReward = mode.SKeyProgressReward,
        IsActive = mode.IsActive,
        RowVersion = mode.RowVersion
    };
}
