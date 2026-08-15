using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;

public class KeyController : Controller
{

    private readonly QmahDbContext _db;

    public KeyController(QmahDbContext db)
    {
        _db = db;
    }


    public async Task<IActionResult> List(C_KeywordViewModel vm, CancellationToken cancellationToken)
    {
        IEnumerable<Artifact> datas_keyD = null;

        var artifacts = await _db.KeyDefinitions
            .AsNoTracking()
            .Include(keydefinitions => keydefinitions.Category)
            .Include(keydefinitions => keydefinitions.EraBucket)
            .OrderBy(keydefinitions => keydefinitions.Name)
            .ToListAsync(cancellationToken);
        return View(datas_keyD);
    }
    public IActionResult Create()
    {
        return View();
    }
    public IActionResult delete()
    {
        return View();
    }
    public IActionResult Edit()
    {
        return View();
    }
    
    [HttpPost]
    public IActionResult Edit(int? id)
    {
        return View();
    }



}
