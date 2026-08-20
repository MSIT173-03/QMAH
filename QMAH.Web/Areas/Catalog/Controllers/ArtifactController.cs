using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Office2010.Excel;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("文物總覽", order: 10)]
public class ArtifactController : Controller
{
    private readonly QmahDbContext _db;

    public ArtifactController(QmahDbContext db)
    {
        _db = db;
    }

    public async Task<IActionResult> Index(
        C_KeywordViewModel vm,
        Guid? eraBucketId,
        Guid? categoryId,
        string? sortDirection,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = NormalizePageSize(pageSize);
        vm.txtKeyword = vm.txtKeyword?.Trim();

        var isDescending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        var query = _db.Artifacts
            .AsNoTracking()
            .Include(artifact => artifact.Category)
            .Include(artifact => artifact.EraBucket)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(vm.txtKeyword))
        {
            query = query.Where(artifact =>
                artifact.Name.Contains(vm.txtKeyword) ||
                artifact.ArtifactRef.Contains(vm.txtKeyword) ||
                (artifact.EraTextOriginal != null && artifact.EraTextOriginal.Contains(vm.txtKeyword)));
        }

        if (eraBucketId.HasValue)
        {
            query = query.Where(artifact => artifact.EraBucketId == eraBucketId.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(artifact => artifact.CategoryId == categoryId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = isDescending
            ? query.OrderByDescending(artifact => artifact.Id)
            : query.OrderBy(artifact => artifact.Id);

        var artifacts = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var eraBuckets = await _db.EraBuckets
            .AsNoTracking()
            .OrderBy(era => era.Name)
            .ToListAsync(cancellationToken);

        var categories = await _db.ArtifactCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .ToListAsync(cancellationToken);

        ViewBag.ArtifactCategoryList = new SelectList(categories, "Id", "Name", categoryId);
        ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", eraBucketId);
        ViewBag.SelectedCategory = categoryId;
        ViewBag.SelectedEraBucketId = eraBucketId;
        ViewBag.SortDirection = isDescending ? "desc" : "asc";
        ViewBag.Page = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        return View(artifacts);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? id)
    {
        var artifact = _db.Artifacts
            .AsNoTracking()
            .Include(item => item.ArtifactQuestionEntry)
            .Include(item => item.ArtifactUnlocks)
            .FirstOrDefault(item => item.Id == id);

        if (artifact == null)
        {
            return Content("Id 不存在");
        }

        artifact.IsActive = false;
        _db.SaveChanges();
        TempData["Success"] = "文物已停用。";

        return RedirectToAction(nameof(Index));
    }

    public ActionResult Edit(Guid? id, Guid eraBucketId, Guid categoryId)
    {
        if (id == null)
        {
            return Content("Id 不存在");
        }

        var eraBuckets = _db.EraBuckets
            .OrderBy(era => era.Name)
            .ToList();

        var categories = _db.ArtifactCategories
            .OrderBy(category => category.Name)
            .ToList();

        var artifact = _db.Artifacts.FirstOrDefault(item => item.Id == id);
        if (artifact == null)
        {
            return Content("Id 不存在");
        }

        ViewBag.ArtifactCategoryList = new SelectList(categories, "Id", "Name", artifact.CategoryId);
        ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", artifact.EraBucketId);

        return View(artifact);
    }

    [HttpPost]
    public ActionResult Edit(Artifact af, Guid eraBucketId, Guid categoryId)
    {
        var artifact = _db.Artifacts.FirstOrDefault(item => item.Id == af.Id);
        if (artifact == null)
        {
            return Content("Id 不存在");
        }

        if (!string.IsNullOrWhiteSpace(af.PrimaryImagePath))
        {
            artifact.PrimaryImagePath = af.PrimaryImagePath;
        }

        artifact.ThumbnailPath = af.ThumbnailPath;
        artifact.ArtifactRef = af.ArtifactRef;
        artifact.Name = af.Name;
        artifact.CategoryId = af.CategoryId;
        artifact.EraBucketId = af.EraBucketId;
        artifact.EraTextOriginal = af.EraTextOriginal;
        artifact.CreatorDisplay = af.CreatorDisplay;
        artifact.Description = af.Description;
        artifact.SourceUrl = af.SourceUrl;
        artifact.LicenseCode = af.LicenseCode;
        artifact.AttributionText = af.AttributionText;
        artifact.SizeText = af.SizeText;
        artifact.IsActive = af.IsActive;

        _db.SaveChanges();
        TempData["Success"] = "文物資料已更新。";

        return RedirectToAction(nameof(Index));
    }

    private static int NormalizePageSize(int pageSize) =>
        pageSize is 10 or 20 or 50 or 100 ? pageSize : 20;
}
