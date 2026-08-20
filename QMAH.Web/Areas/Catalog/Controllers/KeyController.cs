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
[AdminNavigation("鑰匙規則", order: 20)]
public class KeyController : Controller
{
    private readonly QmahDbContext _db;

    public KeyController(QmahDbContext db)
    {
        _db = db;
    }

    public async Task<ActionResult> Index(CancellationToken cancellationToken)
    {
        IEnumerable<KeyDefinition> datas_keyD = [];

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
        return View(new KeyDefinition
        {
            ScopeType = "NORMAL",
            IsActive = true
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Create(KeyDefinition kd, Guid eraBucketId, Guid categoryId)
    {
        NormalizeScope(kd);

        var errorMessage = ValidateKey(kd);
        if (errorMessage != null)
        {
            ViewBag.ErrorMessage = errorMessage;
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }

        try
        {
            kd.Id = Guid.NewGuid();
            _db.KeyDefinitions.Add(kd);
            _db.SaveChanges();
            return RedirectToAction("Index");
        }
        catch (DbUpdateException)
        {
            ViewBag.ErrorMessage = "儲存失敗，請確認鑰匙代碼沒有重複，且解鎖範圍符合設定。";
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }
        catch (Exception)
        {
            ViewBag.ErrorMessage = "發生未預期的錯誤,請稍後再試。";
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? id)
    {
        var kd = _db.KeyDefinitions.FirstOrDefault(t => t.Id == id);
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

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken cancellationToken)
    {
        var key = await _db.KeyDefinitions.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (key == null) return NotFound();

        key.IsActive = !key.IsActive;
        await _db.SaveChangesAsync(cancellationToken);

        return RedirectToAction(nameof(Index));
    }

    public ActionResult Edit(Guid? id, Guid eraBucketId, Guid categoryId)
    {
        if (id == null)
        {
            return Content("Id 不存在");
        }

        var kd = _db.KeyDefinitions.FirstOrDefault(t => t.Id == id);
        if (kd == null) return Content("Id 不存在");

        data(kd.EraBucketId, kd.CategoryId);

        return View(kd);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Edit(KeyDefinition kd, Guid eraBucketId, Guid categoryId)
    {
        var k = _db.KeyDefinitions.FirstOrDefault(t => t.Id == kd.Id);

        if (k == null)
        {
            return Content("Id 不存在");
        }

        NormalizeScope(kd);

        var errorMessage = ValidateKey(kd, kd.Id);
        if (errorMessage != null)
        {
            ViewBag.ErrorMessage = errorMessage;
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }

        try
        {
            k.Name = kd.Name;
            k.Code = kd.Code;
            k.ScopeType = kd.ScopeType;
            k.CategoryId = kd.CategoryId;
            k.EraBucketId = kd.EraBucketId;
            k.IsActive = kd.IsActive;
            _db.SaveChanges();
        }
        catch (DbUpdateException)
        {
            ViewBag.ErrorMessage = "儲存失敗，請確認鑰匙代碼沒有重複，且解鎖範圍符合設定。";
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }
        catch (Exception)
        {
            ViewBag.ErrorMessage = "發生未預期的錯誤,請稍後再試。";
            data(kd.EraBucketId, kd.CategoryId);
            return View(kd);
        }

        return RedirectToAction("Index");
    }

    private void NormalizeScope(KeyDefinition kd)
    {
        kd.ScopeType = kd.ScopeType?.Trim().ToUpperInvariant() ?? string.Empty;

        if (kd.ScopeType == "CATEGORY")
        {
            kd.EraBucketId = null;
        }
        else if (kd.ScopeType == "ERA")
        {
            kd.CategoryId = null;
        }
        else if (kd.ScopeType == "NORMAL" || kd.ScopeType == "UNIVERSAL")
        {
            kd.CategoryId = null;
            kd.EraBucketId = null;
        }
    }

    private string? ValidateKey(KeyDefinition kd, Guid? currentId = null)
    {
        if (kd.ScopeType != "NORMAL" &&
            kd.ScopeType != "CATEGORY" &&
            kd.ScopeType != "ERA" &&
            kd.ScopeType != "UNIVERSAL")
        {
            return "請選擇有效的鑰匙類型。";
        }

        if (kd.ScopeType == "CATEGORY" && kd.CategoryId == null)
        {
            return "分類鑰匙一定要選分類。";
        }

        if (kd.ScopeType == "ERA" && kd.EraBucketId == null)
        {
            return "年代鑰匙一定要選年代。";
        }

        var others = _db.KeyDefinitions
            .AsNoTracking()
            .Where(t => currentId == null || t.Id != currentId);

        if (others.Any(t => t.Code == kd.Code))
        {
            return "鑰匙代碼已經存在。";
        }

        var scopeExists = kd.ScopeType switch
        {
            "NORMAL" => others.Any(t => t.ScopeType == "NORMAL"),
            "UNIVERSAL" => others.Any(t => t.ScopeType == "UNIVERSAL"),
            "CATEGORY" => others.Any(t => t.ScopeType == "CATEGORY" && t.CategoryId == kd.CategoryId),
            "ERA" => others.Any(t => t.ScopeType == "ERA" && t.EraBucketId == kd.EraBucketId),
            _ => false
        };

        if (scopeExists)
        {
            return "這個解鎖範圍已經有鑰匙規則，請直接編輯或重新啟用原本的規則。";
        }

        return null;
    }

    private void data(Guid? eraBucketId, Guid? categoryId)
    {
        var eraBuckets = _db.EraBuckets.OrderBy(e => e.Name).ToList();
        var category = _db.ArtifactCategories.OrderBy(e => e.Name).ToList();

        ViewBag.ArtifactCategoryList = new SelectList(category, "Id", "Name", categoryId);
        ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", eraBucketId);
    }
}
