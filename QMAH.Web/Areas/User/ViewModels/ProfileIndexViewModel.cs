using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class ProfileIndexViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public UserProfile Profile { get; set; } = null!;

    public List<UserAddress> Addresses { get; set; } = new();

    // 新增
    public int PointBalance { get; set; }

    public List<PointTransaction> RecentPointTransactions { get; set; } = new();

    public int AchievementCount { get; set; }
}