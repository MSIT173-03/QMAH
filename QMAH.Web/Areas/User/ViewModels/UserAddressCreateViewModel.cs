using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.User.ViewModels;

public class UserAddressCreateViewModel
{
    public Guid UserId { get; set; }

    [Required(ErrorMessage = "請輸入地址標籤。")]
    public string AddressLabel { get; set; } = "";

    [Required(ErrorMessage = "請輸入收件人姓名。")]
    public string RecipientName { get; set; } = "";

    [Required(ErrorMessage = "請輸入收件人電話。")]
    public string RecipientPhone { get; set; } = "";

    public string? PostalCode { get; set; }

    public string? City { get; set; }

    public string? District { get; set; }

    [Required(ErrorMessage = "請輸入詳細地址。")]
    public string AddressLine { get; set; } = "";

    public bool IsDefault { get; set; }
}