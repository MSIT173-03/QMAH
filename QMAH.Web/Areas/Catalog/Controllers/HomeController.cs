using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public sealed class HomeController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var model = new CatalogDashboardViewModel
        {
            ArtifactCount = await db.Artifacts.CountAsync(cancellationToken),
            ActiveArtifactCount = await db.Artifacts.CountAsync(
                artifact => artifact.IsActive,
                cancellationToken),
            CategoryCount = await db.ArtifactCategories.CountAsync(cancellationToken),
            EraBucketCount = await db.EraBuckets.CountAsync(cancellationToken),
            KeyDefinitionCount = await db.KeyDefinitions.CountAsync(cancellationToken),
            UnlockCount = await db.ArtifactUnlocks.CountAsync(cancellationToken)
        };

        ViewData["AdminDescription"] = "文物資料、分類、年代與解鎖狀態的共同入口。";
        return View(model);
    }
}
