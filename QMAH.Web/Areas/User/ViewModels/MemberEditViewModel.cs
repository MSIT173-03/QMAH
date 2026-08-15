namespace QMAH.Web.Areas.User.ViewModels;

public class MemberEditViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    public string Nickname { get; set; } = "";

    public string? Bio { get; set; }

    public string? AvatarPath { get; set; }

    public string Visibility { get; set; } = "PUBLIC";
}