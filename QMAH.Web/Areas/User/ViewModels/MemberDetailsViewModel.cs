using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class MemberDetailsViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public UserProfile? Profile { get; set; }

    public List<UserAddress> Addresses { get; set; } = new();

    public List<PointTransaction> PointTransactions { get; set; } = new();

    public List<UserAchievement> Achievements { get; set; } = new();

    public List<string> Roles { get; set; } = new();

    public int CurrentBalance { get; set; }
}