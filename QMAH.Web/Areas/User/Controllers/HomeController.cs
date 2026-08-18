using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
public class HomeController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly QmahDbContext _context;

    public HomeController(
        UserManager<ApplicationUser> userManager,
        QmahDbContext context)
    {
        _userManager = userManager;
        _context = context;
    }

    public async Task<IActionResult> Index()
    {
        var now = DateTime.UtcNow;
        var thirtyDaysAgo = now.AddDays(-30);

        // =========================
        // 個人檔案與近期活動
        // =========================

        var recentProfiles = await _context.UserProfiles
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt)
            .Take(5)
            .ToListAsync();

        var profileActivities =
            new List<ProfileActivityListItemViewModel>();

        foreach (var profile in recentProfiles)
        {
            var user = await _userManager.FindByIdAsync(
                profile.UserId.ToString());

            if (user == null)
            {
                continue;
            }

            var postCount = await _context.SocialPosts
                .CountAsync(x =>
                    x.UserId == profile.UserId);

            var commentCount = await _context.SocialComments
                .CountAsync(x =>
                    x.UserId == profile.UserId);

            var latestPost = await _context.SocialPosts
                .AsNoTracking()
                .Where(x =>
                    x.UserId == profile.UserId)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            var latestComment = await _context.SocialComments
                .AsNoTracking()
                .Where(x =>
                    x.UserId == profile.UserId)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

            var recentActivity = "更新個人檔案";

            // 如果貼文時間比 Profile 更新時間新
            if (latestPost != null &&
                latestPost.CreatedAt >= profile.UpdatedAt)
            {
                recentActivity = "發表貼文";
            }

            // 如果留言又比貼文更新
            if (latestComment != null &&
                latestComment.CreatedAt >= profile.UpdatedAt &&
                (latestPost == null ||
                 latestComment.CreatedAt >= latestPost.CreatedAt))
            {
                recentActivity = "發表留言";
            }

            profileActivities.Add(
                new ProfileActivityListItemViewModel
                {
                    UserId = user.Id,
                    Email = user.Email ?? "",
                    Nickname = profile.Nickname,
                    Visibility = profile.Visibility,
                    PostCount = postCount,
                    CommentCount = commentCount,
                    RecentActivity = recentActivity
                });
        }

        // =========================
        // Dashboard
        // =========================

        var model = new HomeDashboardViewModel
        {
            TotalMembers =
                await _userManager.Users.CountAsync(),

            NewMembers =
                await _userManager.Users
                    .CountAsync(x =>
                        x.CreatedAt >= thirtyDaysAgo),

            BannedMembers =
                await _userManager.Users
                    .CountAsync(x =>
                        x.Status == "BANNED"),

            RecentMembers =
                await _userManager.Users
                    .AsNoTracking()
                    .OrderByDescending(x => x.CreatedAt)
                    .Take(5)
                    .ToListAsync(),

            ProfileActivities =
                profileActivities,

            RecentPointTransactions =
                await _context.PointTransactions
                    .AsNoTracking()
                    .OrderByDescending(x => x.CreatedAt)
                    .Take(5)
                    .ToListAsync(),

            Achievements =
                await _context.Achievements
                    .AsNoTracking()
                    .OrderBy(x => x.Name)
                    .Take(5)
                    .ToListAsync()
        };

        return View(model);
    }
}