using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.User.ViewModels;

public sealed class ChangeOwnPasswordViewModel
{
    [Required(ErrorMessage = "請輸入目前密碼。"), DataType(DataType.Password), Display(Name = "目前密碼")]
    public string CurrentPassword { get; set; } = "";

    [Required(ErrorMessage = "請輸入新密碼。"), StringLength(100, MinimumLength = 8, ErrorMessage = "新密碼至少需要 8 個字元。"), DataType(DataType.Password), Display(Name = "新密碼")]
    public string NewPassword { get; set; } = "";

    [Required(ErrorMessage = "請再次輸入新密碼。"), Compare(nameof(NewPassword), ErrorMessage = "兩次輸入的新密碼不一致。"), DataType(DataType.Password), Display(Name = "確認新密碼")]
    public string ConfirmPassword { get; set; } = "";
}

public sealed class ResetMemberPasswordViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    [Required(ErrorMessage = "請輸入新密碼。"), StringLength(100, MinimumLength = 8, ErrorMessage = "新密碼至少需要 8 個字元。"), DataType(DataType.Password), Display(Name = "新密碼")]
    public string NewPassword { get; set; } = "";

    [Required(ErrorMessage = "請再次輸入新密碼。"), Compare(nameof(NewPassword), ErrorMessage = "兩次輸入的新密碼不一致。"), DataType(DataType.Password), Display(Name = "確認新密碼")]
    public string ConfirmPassword { get; set; } = "";
}
