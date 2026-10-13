using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace QMAH.Web.Areas.User.ViewModels;

public sealed class MemberDeleteViewModel
{
    public Guid UserId { get; set; }
    [BindNever, ValidateNever] public string Email { get; set; } = "";
    [Required(ErrorMessage = "請輸入會員帳號識別，以確認刪除對象。")]
    [StringLength(256)] public string ConfirmationEmail { get; set; } = "";
}
