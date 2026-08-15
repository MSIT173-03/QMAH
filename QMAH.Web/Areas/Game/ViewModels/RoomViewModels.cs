using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Game.ViewModels;

public sealed class RoomIndexViewModel
{
    public string? Search { get; init; }

    public string? Status { get; init; }

    public string? Visibility { get; init; }

    public string Sort { get; init; } = "created";

    public int PageSize { get; init; } = 20;

    public required PagedResult<RoomListItemViewModel> Results { get; init; }
}

public class RoomListItemViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public required string Status { get; init; }

    public required string Visibility { get; init; }

    public byte MaxPlayers { get; init; }

    public byte CurrentRoundNo { get; init; }

    public byte TotalRounds { get; init; }

    public int PlayerCount { get; init; }

    public int RoundCount { get; init; }

    public DateTime CreatedAt { get; init; }
}

public sealed class RoomDetailsViewModel : RoomListItemViewModel
{
    public short AnswerSeconds { get; init; }

    public short VotingSeconds { get; init; }

    public string? CategoryFilterCode { get; init; }

    public string? CategoryFilterName { get; init; }

    public string? EraBucketFilterCode { get; init; }

    public string? EraBucketFilterName { get; init; }

    public int StateVersion { get; init; }

    public required string RowVersion { get; init; }

    public DateTime? StartedAt { get; init; }

    public DateTime? EndedAt { get; init; }

    public DateTime? CompletedAt { get; init; }

    public IReadOnlyList<RoomPlayerItemViewModel> Players { get; init; } = [];

    public IReadOnlyList<RoomRoundItemViewModel> Rounds { get; init; } = [];
}

public sealed class RoomPlayerItemViewModel
{
    public Guid Id { get; init; }

    public required string DisplayName { get; init; }

    public required string Role { get; init; }

    public required string ConnectionStatus { get; init; }

    public bool IsReady { get; init; }

    public byte? SeatNo { get; init; }
}

public sealed class RoomRoundItemViewModel
{
    public Guid Id { get; init; }

    public int RoundNumber { get; init; }

    public required string ArtifactName { get; init; }

    public required string Status { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }
}

public abstract class RoomFormViewModel : IValidatableObject
{
    [Display(Name = "房間代碼")]
    [Required(ErrorMessage = "請輸入房間代碼")]
    [StringLength(12, MinimumLength = 4, ErrorMessage = "房間代碼長度必須介於 4 到 12 個字元")]
    public string RoomCode { get; set; } = string.Empty;

    [Display(Name = "可見範圍")]
    [Required]
    public string Visibility { get; set; } = "PUBLIC";

    [Display(Name = "房間密碼")]
    [StringLength(100, MinimumLength = 4, ErrorMessage = "密碼長度至少 4 個字元")]
    [DataType(DataType.Password)]
    public string? Password { get; set; }

    [Display(Name = "人數上限")]
    [Range(3, 10)]
    public byte MaxPlayers { get; set; } = 10;

    [Display(Name = "總回合數")]
    [Range(1, 5)]
    public byte TotalRounds { get; set; } = 3;

    [Display(Name = "作答秒數")]
    [Range(30, 300)]
    public short AnswerSeconds { get; set; } = 120;

    [Display(Name = "投票秒數")]
    [Range(20, 180)]
    public short VotingSeconds { get; set; } = 60;

    [Display(Name = "限定分類")]
    public string? CategoryFilterCode { get; set; }

    [Display(Name = "限定年代")]
    public string? EraBucketFilterCode { get; set; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var visibility = Visibility?.Trim().ToUpperInvariant() ?? string.Empty;

        if (visibility is not ("PUBLIC" or "PRIVATE"))
        {
            yield return new ValidationResult("可見範圍不正確", [nameof(Visibility)]);
        }

        if (visibility == "PRIVATE" && string.IsNullOrWhiteSpace(Password) && this is RoomCreateViewModel)
        {
            yield return new ValidationResult("私人房間必須設定密碼", [nameof(Password)]);
        }
    }
}

public sealed class RoomCreateViewModel : RoomFormViewModel;

public sealed class RoomEditViewModel : RoomFormViewModel
{
    public Guid Id { get; set; }

    public string Status { get; set; } = string.Empty;

    public string RowVersion { get; set; } = string.Empty;
}

public sealed class RoomDeleteViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public int PlayerCount { get; init; }

    public int RoundCount { get; init; }

    public required string RowVersion { get; init; }

    public bool CanDelete { get; init; }
}
