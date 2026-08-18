using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "Policy.SocialAdmin.Access")]
    public sealed class HomeController(QmahDbContext db) : Controller
    {
        public async Task<IActionResult> Index(CancellationToken cancellationToken)
        {
            var model = new SocialDashboardViewModel
            {
                PublishedPostCount = await db.SocialPosts.CountAsync(
                    post => post.Status == "PUBLISHED",
                    cancellationToken),
                CommentCount = await db.SocialComments.CountAsync(cancellationToken),
                PendingReportCount = await db.ContentReports.CountAsync(
                    report => report.Status == "PENDING",
                    cancellationToken),
                PendingEventCount = await db.Events.CountAsync(
                    item => item.ReviewStatus == "PENDING",
                    cancellationToken),
                PublishedEventCount = await db.Events.CountAsync(
                    item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED",
                    cancellationToken),
                PublishedAnnouncementCount = await db.OfficialAnnouncements.CountAsync(
                    item => item.Status == "PUBLISHED",
                    cancellationToken),
                RecentPosts = await db.SocialPosts
                    .AsNoTracking()
                    .Where(post => post.Status == "PUBLISHED")
                    .OrderByDescending(post => post.CreatedAt)
                    .Take(6)
                    .Select(post => new SocialDashboardPostItem
                    {
                        Id = post.Id,
                        BoardCode = post.BoardCode,
                        Title = post.Title,
                        CreatedAt = post.CreatedAt
                    })
                    .ToListAsync(cancellationToken)
            };

            ViewData["AdminDescription"] = "貼文、活動、公告與社群風控的共同工作台。";
            return View(model);
        }
    }
}
