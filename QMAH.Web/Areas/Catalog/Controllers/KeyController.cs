using DocumentFormat.OpenXml.Drawing.Charts;
using DocumentFormat.OpenXml.Office2010.Excel;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.DotNet.Scaffolding.Shared.Messaging;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;



[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("鑰匙總覽", order: 10)]
public class KeyController : Controller
{

    private readonly QmahDbContext _db;

    public KeyController(QmahDbContext db)
    {
        _db = db;
    }


    public async Task<ActionResult> Index(CancellationToken cancellationToken)
    {
        IEnumerable<KeyDefinition> datas_keyD = null;

        var keyd = await _db.KeyDefinitions
            .AsNoTracking()
            .Include(keydefinitions => keydefinitions.Category)
            .Include(keydefinitions => keydefinitions.EraBucket)
            .OrderBy(keydefinitions => keydefinitions.Name)
            .ToListAsync(cancellationToken);

        datas_keyD = from t in keyd
                     select t;

        return View(datas_keyD);
    }


    public ActionResult Create(Guid eraBucketId, Guid categoryId)
    {
        data(eraBucketId, categoryId);
        return View();
    }

    [HttpPost]
    public ActionResult Create(KeyDefinition kd, Guid eraBucketId, Guid categoryId)
    {
        try
        {
            kd.Id = Guid.NewGuid();
            _db.KeyDefinitions.Add(kd);
            _db.SaveChanges();
            return RedirectToAction("Index");
        }
        catch (DbUpdateException ex)
        {
            ViewBag.ErrorMessage = "選填資料與所選Scope type不同。";
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }
        catch (Exception ex)
        {
            ViewBag.ErrorMessage = "發生未預期的錯誤,請稍後再試。";
            return View(kd);
        }
    }


    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? id)
    {
        KeyDefinition kd = _db.KeyDefinitions.FirstOrDefault(t => t.Id == id);
        if (kd != null)
        {
            kd.IsActive = false;
            _db.SaveChanges();
        }
        else
        {
            return Content("Id 不存在");
        }
        return RedirectToAction("Index");
    }


    public ActionResult Edit(Guid? id, Guid eraBucketId, Guid categoryId)
    {
        if (id == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            KeyDefinition kd = _db.KeyDefinitions.FirstOrDefault(t => t.Id == id);
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }
    }

    [HttpPost]
    public IActionResult Edit(KeyDefinition kd, Guid eraBucketId, Guid categoryId)
    {
        KeyDefinition k = _db.KeyDefinitions.FirstOrDefault(t => t.Id == kd.Id);
        if (kd.Id == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            try
            {
                k.Name = kd.Name;
                k.Code = kd.Code;
                k.ScopeType = kd.ScopeType;
                k.CategoryId = kd.CategoryId;
                k.EraBucketId = kd.EraBucketId;
                _db.SaveChanges();
            }
            catch (DbUpdateException ex)
            {
                ViewBag.ErrorMessage = "選填資料與所選Scope type不同。";
                data(kd.EraBucketId, kd.CategoryId);
                return View(kd);
            }
            catch (Exception ex)
            {
                ViewBag.ErrorMessage = "發生未預期的錯誤,請稍後再試。";
                return View(kd);
            }

        }
        return RedirectToAction("Index");
    }


    private void data(Guid? eraBucketId, Guid? categoryId)
    {
        var eraBuckets = _db.EraBuckets.OrderBy(e => e.Name).ToList();
        var category = _db.ArtifactCategories.OrderBy(e => e.Name).ToList();

        ViewBag.ArtifactCategoryList = new SelectList(category, "Id", "Name", categoryId);
        ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", eraBucketId);
    }


}
