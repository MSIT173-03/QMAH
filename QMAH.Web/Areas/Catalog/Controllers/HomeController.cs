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
            UnlockCount = await db.ArtifactUnlocks.CountAsync(cancellationToken),
            CategoryBreakdown = await db.Artifacts
                .AsNoTracking()
                .GroupBy(x => x.Category.Name)
                .OrderByDescending(x => x.Count())
                .Select(x => new CatalogBreakdownItemViewModel
                {
                    Name = x.Key,
                    Count = x.Count(),
                    ActiveCount = x.Count(item => item.IsActive)
                })
                .ToListAsync(cancellationToken),
            EraBreakdown = await db.Artifacts
                .AsNoTracking()
                .GroupBy(x => x.EraBucket.Name)
                .OrderByDescending(x => x.Count())
                .Select(x => new CatalogBreakdownItemViewModel
                {
                    Name = x.Key,
                    Count = x.Count(),
                    ActiveCount = x.Count(item => item.IsActive)
                })
                .ToListAsync(cancellationToken),
            KeyScopeBreakdown = await db.KeyDefinitions
                .AsNoTracking()
                .GroupBy(x => x.ScopeType)
                .OrderByDescending(x => x.Count())
                .Select(x => new CatalogBreakdownItemViewModel
                {
                    Name = x.Key,
                    Count = x.Count(),
                    ActiveCount = x.Count(item => item.IsActive)
                })
                .ToListAsync(cancellationToken),
            RecentUnlocks = await db.ArtifactUnlocks
                .AsNoTracking()
                .OrderByDescending(x => x.UnlockedAt)
                .Take(8)
                .Select(x => new CatalogRecentUnlockViewModel
                {
                    ArtifactName = x.Artifact.Name,
                    UnlockMethod = x.UnlockMethod,
                    UnlockedAt = x.UnlockedAt
                })
                .ToListAsync(cancellationToken)
        };

        ViewData["AdminDescription"] = "文物資料、分類、年代與解鎖狀態的共同入口。";
        return View(model);
    }
}
