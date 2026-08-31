using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class MemberListItemViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public string Role { get; set; } = "";

    public int PointBalance { get; set; }
    public string? Nickname { get; set; }
}