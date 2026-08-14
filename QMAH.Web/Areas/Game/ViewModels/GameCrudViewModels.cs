using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Game.ViewModels;

public abstract class PlayerFormViewModel
{
    [Display(Name = "顯示名稱")]
    [Required(ErrorMessage = "請輸入玩家顯示名稱")]
    [StringLength(80)]
    public string DisplayName { get; set; } = string.Empty;

    [Display(Name = "玩家識別碼")]
    [Required(ErrorMessage = "請輸入玩家識別碼")]
    [StringLength(80)]
    public string PlayerKey { get; set; } = string.Empty;

    [Display(Name = "角色")]
    [Required(ErrorMessage = "請選擇玩家角色")]
    public string Role { get; set; } = "PLAYER";

    [Display(Name = "準備狀態")]
    public bool IsReady { get; set; }

    [Display(Name = "座位")]
    [Range(1, 10, ErrorMessage = "座位必須介於 1 到 10")]
    public byte? SeatNo { get; set; }

    [Display(Name = "連線狀態")]
    [Required(ErrorMessage = "請選擇連線狀態")]
    public string ConnectionStatus { get; set; } = "ONLINE";
}

public sealed class PlayerCreateViewModel : PlayerFormViewModel
{
    [Display(Name = "房間")]
    [Required(ErrorMessage = "請選擇房間")]
    public Guid? RoomId { get; set; }

    [Display(Name = "會員")]
    [Required(ErrorMessage = "請選擇會員")]
    public Guid? UserId { get; set; }
}

public sealed class PlayerEditViewModel : PlayerFormViewModel
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string UserName { get; set; } = string.Empty;

    public int AnswerCount { get; set; }

    public int VoteCount { get; set; }

    public string RowVersion { get; set; } = string.Empty;
}

public sealed class PlayerDeleteViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public required string DisplayName { get; init; }

    public required string PlayerKey { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }

    public required string RowVersion { get; init; }

    public bool CanDelete => AnswerCount == 0 && VoteCount == 0;
}

public abstract class RoundFormViewModel : IValidatableObject
{
    [Display(Name = "房間")]
    [Required(ErrorMessage = "請選擇房間")]
    public Guid? RoomId { get; set; }

    [Display(Name = "文物")]
    [Required(ErrorMessage = "請選擇文物")]
    public Guid? ArtifactId { get; set; }

    [Display(Name = "回合編號")]
    [Range(1, int.MaxValue, ErrorMessage = "回合編號必須大於 0")]
    public int RoundNumber { get; set; } = 1;

    [Display(Name = "狀態")]
    [Required(ErrorMessage = "請選擇回合狀態")]
    public string Status { get; set; } = "ANSWERING";

    [Display(Name = "狀態版本")]
    [Range(0, int.MaxValue)]
    public int StateVersion { get; set; }

    [Display(Name = "已結算")]
    public bool IsSettled { get; set; }

    [Display(Name = "開始時間")]
    public DateTime StartedAt { get; set; }

    [Display(Name = "作答截止")]
    public DateTime AnswerDeadlineAt { get; set; }

    [Display(Name = "投票截止")]
    public DateTime VotingDeadlineAt { get; set; }

    [Display(Name = "結算時間")]
    public DateTime? SettledAt { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!GameCodeLists.RoundStatuses.ContainsKey(Status?.Trim().ToUpperInvariant() ?? string.Empty))
        {
            yield return new ValidationResult("回合狀態不正確", [nameof(Status)]);
        }

        if (AnswerDeadlineAt <= StartedAt)
        {
            yield return new ValidationResult("作答截止時間必須晚於開始時間", [nameof(AnswerDeadlineAt)]);
        }

        if (VotingDeadlineAt <= AnswerDeadlineAt)
        {
            yield return new ValidationResult("投票截止時間必須晚於作答截止時間", [nameof(VotingDeadlineAt)]);
        }

        if (Status == "REVEALED" && !IsSettled)
        {
            yield return new ValidationResult("已揭曉回合必須標記為已結算", [nameof(IsSettled)]);
        }

        if (Status == "REVEALED" && !SettledAt.HasValue)
        {
            yield return new ValidationResult("已揭曉回合必須填寫結算時間", [nameof(SettledAt)]);
        }

        if (Status != "REVEALED" && IsSettled)
        {
            yield return new ValidationResult("作答中或投票中的回合不能標記為已結算", [nameof(IsSettled)]);
        }

        if (Status != "REVEALED" && SettledAt.HasValue)
        {
            yield return new ValidationResult("作答中或投票中的回合不能填寫結算時間", [nameof(SettledAt)]);
        }

        if (SettledAt.HasValue && SettledAt.Value < StartedAt)
        {
            yield return new ValidationResult("結算時間不能早於開始時間", [nameof(SettledAt)]);
        }
    }
}

public sealed class RoundCreateViewModel : RoundFormViewModel;

public sealed class RoundEditViewModel : RoundFormViewModel
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string ArtifactName { get; set; } = string.Empty;

    public int AnswerCount { get; set; }

    public int VoteCount { get; set; }

    public string RowVersion { get; set; } = string.Empty;
}

public sealed class RoundDeleteViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string ArtifactName { get; init; }

    public int AnswerCount { get; init; }

    public int VoteCount { get; init; }

    public int UnlockCount { get; init; }

    public required string RowVersion { get; init; }

    public bool CanDelete => AnswerCount == 0 && VoteCount == 0 && UnlockCount == 0;
}

public abstract class AnswerFormViewModel
{
    [Display(Name = "回合")]
    [Required(ErrorMessage = "請選擇回合")]
    public Guid? RoundId { get; set; }

    [Display(Name = "作答玩家")]
    [Required(ErrorMessage = "請選擇作答玩家")]
    public Guid? GamePlayerId { get; set; }

    [Display(Name = "作答類型")]
    [Required(ErrorMessage = "請選擇作答類型")]
    public string AnswerType { get; set; } = "FACTUAL_REASONING";

    [Display(Name = "作答內容")]
    [Required(ErrorMessage = "請輸入作答內容")]
    [StringLength(500)]
    public string Text { get; set; } = string.Empty;

    [Display(Name = "送出時間")]
    public DateTime SubmittedAt { get; set; }
}

public sealed class AnswerCreateViewModel : AnswerFormViewModel;

public sealed class AnswerEditViewModel : AnswerFormViewModel
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public int RoundNumber { get; set; }

    public string PlayerName { get; set; } = string.Empty;

    public int VoteCount { get; set; }

    public string RowVersion { get; set; } = string.Empty;
}

public sealed class AnswerDeleteViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string PlayerName { get; init; }

    public required string Text { get; init; }

    public int VoteCount { get; init; }

    public required string RowVersion { get; init; }

    public bool CanDelete => VoteCount == 0;
}

public abstract class VoteFormViewModel
{
    [Display(Name = "回合")]
    [Required(ErrorMessage = "請選擇回合")]
    public Guid? RoundId { get; set; }

    [Display(Name = "投票玩家")]
    [Required(ErrorMessage = "請選擇投票玩家")]
    public Guid? VoterGamePlayerId { get; set; }

    [Display(Name = "被投作答")]
    [Required(ErrorMessage = "請選擇被投作答")]
    public Guid? AnswerId { get; set; }

    [Display(Name = "票數")]
    [Range(1, 3, ErrorMessage = "票數必須介於 1 到 3")]
    public int Count { get; set; } = 1;

    [Display(Name = "送出時間")]
    public DateTime SubmittedAt { get; set; }
}

public sealed class VoteCreateViewModel : VoteFormViewModel;

public sealed class VoteEditViewModel : VoteFormViewModel
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public int RoundNumber { get; set; }

    public string VoterName { get; set; } = string.Empty;

    public string AnswerPlayerName { get; set; } = string.Empty;

    public string RowVersion { get; set; } = string.Empty;
}

public sealed class VoteDeleteViewModel
{
    public Guid Id { get; init; }

    public required string RoomCode { get; init; }

    public int RoundNumber { get; init; }

    public required string VoterName { get; init; }

    public required string AnswerPlayerName { get; init; }

    public int Count { get; init; }

    public required string RowVersion { get; init; }
}
