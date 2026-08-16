namespace QMAH.Web.Areas.User.ViewModels;

public class MemberRoleEditViewModel
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = "";

    public List<string> AvailableRoles { get; set; } = new();

    public string SelectedRole { get; set; } = "";
}