using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.ViewModels;

/// <summary>管理員查看會員資料、資產與成就稱號時使用的明細模型。</summary>
public class MemberDetailsViewModel
{
    public ApplicationUser User { get; set; } = null!;

    public UserProfile? Profile { get; set; }

    public List<UserAddress> Addresses { get; set; } = new();

    public List<PointTransaction> PointTransactions { get; set; } = new();

    public List<UserAchievement> Achievements { get; set; } = new();

    public QMAH.Infrastructure.Services.Economy.EquippedTitleView? EquippedTitle { get; set; }

    public List<string> Roles { get; set; } = new();

    public int CurrentBalance { get; set; }
}
