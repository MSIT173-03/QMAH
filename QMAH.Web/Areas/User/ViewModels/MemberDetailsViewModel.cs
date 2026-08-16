using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

public class MemberDetailsViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public UserProfile? Profile { get; set; }

    public List<UserAddress> Addresses { get; set; } = new();

    // 會員目前點數
    public int PointBalance { get; set; }

    // 點數異動紀錄
    public List<PointTransaction> PointTransactions { get; set; } = new();

    public List<UserAchievement> Achievements { get; set; } = new();
}