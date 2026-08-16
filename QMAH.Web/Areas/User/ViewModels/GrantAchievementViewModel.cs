using Microsoft.AspNetCore.Mvc.Rendering;

namespace QMAH.Web.Areas.User.ViewModels;

public class GrantAchievementViewModel
{
    // 要授予成就的會員
    public Guid UserId { get; set; }

    // 顯示會員 Email
    public string Email { get; set; } = "";

    // 管理員選擇的成就
    public Guid AchievementId { get; set; }

    // 下拉選單使用
    public List<SelectListItem> AvailableAchievements { get; set; } = new();
}