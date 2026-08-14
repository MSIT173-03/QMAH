using DocumentFormat.OpenXml.InkML;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;


[Area("Catalog")]
public class ArtifactController : Controller
{
        private readonly QmahDbContext _db;

        public ArtifactController(QmahDbContext db)
        {
            _db = db;
        }

        public async Task<IActionResult> List(C_KeywordViewModel vm, Guid? eraBucketId , CancellationToken cancellationToken)
        {
            IEnumerable<Artifact> datas_art = null;

            var artifacts = await _db.Artifacts
                .AsNoTracking()
                .Include(artifact => artifact.Category)
                .Include(artifact => artifact.EraBucket)
                .Where(artifact => artifact.IsActive == true)
                .OrderBy(artifact => artifact.Name)
                .ToListAsync(cancellationToken);
                

             var eraBuckets = await _db.EraBuckets
                .OrderBy(e => e.Name)
                .ToListAsync();

            ViewBag.EraBucketList = new SelectList(eraBuckets, "Id", "Name", eraBucketId);

            if (string.IsNullOrEmpty(vm.txtKeyword) && eraBucketId==null)
            {
                datas_art = from t in artifacts
                select t;
            }
           else
           {
                if (!string.IsNullOrEmpty(vm.txtKeyword) && eraBucketId!=null)
                {
                datas_art = artifacts.Where(t => t.Name.Contains(vm.txtKeyword)
                    || t.EraTextOriginal.Contains(vm.txtKeyword) && t.EraBucketId == eraBucketId);
                }
                else
                {
                    if (eraBucketId!= null)
                    {
                        datas_art = from t in artifacts
                                where t.EraBucketId ==eraBucketId
                                select t;
                    ViewBag.SelectedEraBucketId = eraBucketId;
                     }
                    else
                    {
                        datas_art = artifacts.Where(t => t.Name.Contains(vm.txtKeyword)
                        ||t.EraTextOriginal.Contains(vm.txtKeyword));
                    }
                }
                

           }
           ViewBag.SelectedEraBucketId = eraBucketId;
           return View(datas_art);
         }

        public ActionResult Delete(Guid? id)
        {
            var artifacts = _db.Artifacts;
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
            return RedirectToAction("List");
        }
}
