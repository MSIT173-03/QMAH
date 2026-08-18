using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.User.ViewModels;

public class RegisterViewModel
{
    [Required(ErrorMessage = "請輸入 Email")]
    [EmailAddress(ErrorMessage = "Email 格式不正確")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "請輸入密碼")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [Required(ErrorMessage = "請再次輸入密碼")]
    [DataType(DataType.Password)]
    [Compare(
        nameof(Password),
        ErrorMessage = "兩次輸入的密碼不一致")]
    public string ConfirmPassword { get; set; } = "";

    [Required(ErrorMessage = "請輸入暱稱")]
    public string Nickname { get; set; } = "";
}