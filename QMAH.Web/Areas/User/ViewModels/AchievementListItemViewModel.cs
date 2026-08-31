using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.User.ViewModels;

public class AchievementListItemViewModel
{
    public Achievement Achievement { get; set; } = null!;

    public int EarnedCount { get; set; }
}