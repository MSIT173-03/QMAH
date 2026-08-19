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
        CancellationToken cancellationToken)
    {
        IEnumerable<Artifact> datas_art = null;

        var isDescending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

        var artifactsQuery = _db.Artifacts
            .AsNoTracking()
            .Include(artifact => artifact.Category)
            .Include(artifact => artifact.EraBucket);

        var artifacts = await (isDescending
                ? artifactsQuery.OrderByDescending(artifact => artifact.Id)
                : artifactsQuery.OrderBy(artifact => artifact.Id))
            .ToListAsync(cancellationToken);


        var eraBuckets = await _db.EraBuckets
           .OrderBy(e => e.Name)
           .ToListAsync();


        var category = await _db.ArtifactCategories
           .OrderBy(e => e.Name)
           .ToListAsync();

        ViewBag.ArtifactCategoryList = new SelectList(category, "Id", "Name", categoryId);
        ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", eraBucketId);

        if (string.IsNullOrEmpty(vm.txtKeyword) && eraBucketId == null && categoryId == null)
        {
            datas_art = from t in artifacts
                        select t;
        }
        else
        {
            if (!string.IsNullOrEmpty(vm.txtKeyword) && eraBucketId != null && categoryId != null)
            {
                datas_art = artifacts.Where(t => t.EraBucketId == eraBucketId
                && t.CategoryId == categoryId
                && (t.Name.Contains(vm.txtKeyword)
                || t.EraTextOriginal.Contains(vm.txtKeyword)
                || t.ArtifactRef.Contains(vm.txtKeyword)));
            }
            else
            {
                if (!string.IsNullOrEmpty(vm.txtKeyword) && eraBucketId != null)
                {
                    datas_art = artifacts.Where(t => t.EraBucketId == eraBucketId
                    && (t.Name.Contains(vm.txtKeyword)
                    || t.EraTextOriginal.Contains(vm.txtKeyword)
                    || t.ArtifactRef.Contains(vm.txtKeyword)));
                }

                else if (!string.IsNullOrEmpty(vm.txtKeyword) && categoryId != null)
                {
                    datas_art = artifacts.Where(t => t.CategoryId == categoryId
                    && (t.Name.Contains(vm.txtKeyword)
                    || t.EraTextOriginal.Contains(vm.txtKeyword)
                    || t.ArtifactRef.Contains(vm.txtKeyword)));
                }
                else if (categoryId != null && eraBucketId != null)
                {
                    datas_art = artifacts.Where(t => t.CategoryId == categoryId
                    && t.EraBucketId == eraBucketId);
                }
                else
                {
                    if (eraBucketId != null)
                    {
                        datas_art = artifacts.Where(t => t.EraBucketId == eraBucketId);
                    }
                    if (vm.txtKeyword != null)
                    {
                        datas_art = artifacts.Where(t => t.Name.Contains(vm.txtKeyword)
                        || t.EraTextOriginal.Contains(vm.txtKeyword)
                        || t.ArtifactRef.Contains(vm.txtKeyword));
                    }
                    if (categoryId != null)
                    {
                        datas_art = artifacts.Where(t => t.CategoryId == categoryId);
                    }
                }
            }
        }
        ViewBag.SelectedCategory = categoryId;
        ViewBag.SelectedEraBucketId = eraBucketId;
        ViewBag.SortDirection = isDescending ? "desc" : "asc";
        return View(datas_art);
    }


    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? id)
    {
        Artifact a = _db.Artifacts.FirstOrDefault(t => t.Id == id);
        if (a != null)
        {
            a.IsActive = false;
            _db.SaveChanges();
        }
        else
        {
            return Content("Id 不存在");
        }
        return RedirectToAction(nameof(Index));
    }


    public ActionResult Edit(Guid? id, Guid eraBucketId, Guid categoryId)
    {
        if (id == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            var eraBuckets = _db.EraBuckets
                .OrderBy(e => e.Name)
                .ToList();


            var category = _db.ArtifactCategories
                    .OrderBy(e => e.Name)
                    .ToList();

            Artifact a = _db.Artifacts.FirstOrDefault(t => t.Id == id);
            ViewBag.ArtifactCategoryList = new SelectList(category, "Id", "Name", a.CategoryId);
            ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", a.EraBucketId);
            return View(a);
        }
    }


    [HttpPost]
    public ActionResult Edit(Artifact af, Guid eraBucketId, Guid categoryId)
    {
        Artifact a = _db.Artifacts.FirstOrDefault(t => t.Id == af.Id);
        if (af.Id == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(af.PrimaryImagePath))
            {
                a.PrimaryImagePath = af.PrimaryImagePath;
            }
            a.ThumbnailPath = af.ThumbnailPath;
            a.ArtifactRef = af.ArtifactRef;
            a.Name = af.Name;
            a.CategoryId = af.CategoryId;
            a.EraBucketId = af.EraBucketId;
            a.EraTextOriginal = af.EraTextOriginal;
            a.CreatorDisplay = af.CreatorDisplay;
            a.Description = af.Description;
            a.SourceUrl = af.SourceUrl;
            a.LicenseCode = af.LicenseCode;
            a.AttributionText = af.AttributionText;
            a.SizeText = af.SizeText;
            a.IsActive = af.IsActive;
            _db.SaveChanges();
        }
        return RedirectToAction("Index");
    }
}
