using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class HomeDashboardViewModel
{
    public int TotalMembers { get; set; }

    public int NewMembers { get; set; }

    public int BannedMembers { get; set; }

    public List<ApplicationUser> RecentMembers { get; set; } = new();

    public List<PointTransaction> RecentPointTransactions { get; set; } = new();

    public List<Achievement> Achievements { get; set; } = new();

    public List<ProfileActivityListItemViewModel> ProfileActivities { get; set; } = new();
}