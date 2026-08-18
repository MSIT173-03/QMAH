using System.Diagnostics;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Models;

namespace QMAH.Web.Controllers;

[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public sealed class HomeController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var model = new HomeDashboardViewModel
        {
            ArtifactCount = await db.Artifacts.CountAsync(cancellationToken),
            ActiveArtifactCount = await db.Artifacts.CountAsync(
                artifact => artifact.IsActive,
                cancellationToken),
            PublishedPostCount = await db.SocialPosts.CountAsync(
                post => post.Status == "PUBLISHED",
                cancellationToken),
            ActiveEventCount = await db.Events.CountAsync(
                item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED",
                cancellationToken),
            MemberCount = await db.Users.CountAsync(cancellationToken),
            ActiveMemberCount = await db.Users.CountAsync(
                user => user.Status == "ACTIVE",
                cancellationToken),
            ProductCount = await db.Products.CountAsync(cancellationToken),
            ActiveProductCount = await db.Products.CountAsync(
                product => product.IsActive,
                cancellationToken),
            IsAuthenticated = User.Identity?.IsAuthenticated == true,
            IsAdmin = User.IsInRole("Admin"),
            MemberDisplayName = User.Identity?.Name ?? "會員"
        };

        return View(model);
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
