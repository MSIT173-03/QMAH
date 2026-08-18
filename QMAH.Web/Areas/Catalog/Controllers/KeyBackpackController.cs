using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Vml.Spreadsheet;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;


[Area("Catalog")]
[AdminNavigation("玩家鑰匙背包一覽", order: 10)]
public class KeyBackPackController : Controller
{

    private readonly QmahDbContext _db;
    public KeyBackPackController(QmahDbContext db)
    {
        _db = db;
    }


    public async Task<ActionResult> Index(C_KeywordViewModel vm, Guid? userId, CancellationToken cancellationToken)
    {
        var ukb = await _db.UserKeyBalances
            .AsNoTracking()
            .Include(UserKeyBalances => UserKeyBalances.KeyDefinition)
            .OrderBy(UserKeyBalances => UserKeyBalances.UserId)
            .ToListAsync(cancellationToken);

        var up = await _db.UserProfiles
            .AsNoTracking()
            .OrderBy(e => e.UserId)
            .ToListAsync(cancellationToken);

        var datas_ukb = (from t in ukb
                         join u in up on t.UserId equals u.UserId
                         select new UserKeyBalanceViewModel
                         {
                             UserKeyBalance = t,
                             Nickname = u.Nickname
                         }).ToList();

        var uid = _db.UserProfiles.OrderBy(e => e.UserId).ToList();

        ViewBag.UserProfileList = new SelectList(uid, "UserId", "Nickname", userId);

        if (!string.IsNullOrWhiteSpace(vm.txtKeyword) && userId != null)
        {
            datas_ukb = datas_ukb
                .Where(t => t.UserKeyBalance.UserId == userId && (t.Nickname.Contains(vm.txtKeyword)
                || t.UserKeyBalance.KeyDefinition.Name.Contains(vm.txtKeyword)))
                .ToList();
        }
        else if (!string.IsNullOrWhiteSpace(vm.txtKeyword))
        {
            datas_ukb = datas_ukb
                .Where(t => t.Nickname != null && t.Nickname.Contains(vm.txtKeyword)
                || t.UserKeyBalance.KeyDefinition.Name.Contains(vm.txtKeyword))
                .ToList();
        }
        else if(userId != null)
        {
            datas_ukb = datas_ukb
                .Where(t => t.UserKeyBalance.UserId == userId)
                .ToList();
        }
        else
        {
            datas_ukb = datas_ukb;
        }
        return View(datas_ukb);
    }


    public ActionResult Create(Guid userId, Guid keydefinitionId)
    {
        data(userId, keydefinitionId);
        return View();
    }

    [HttpPost]
    public ActionResult Create(UserKeyBalance ukb, Guid userId, Guid keydefinitionId)
    {
        try
        {
            data(userId, keydefinitionId);
            var existing = _db.UserKeyBalances.FirstOrDefault(x => x.UserId == userId && x.KeyDefinitionId == keydefinitionId);
            if (existing == null)
            {
                ukb.UpdatedAt = DateTime.Now;
                _db.UserKeyBalances.Add(ukb);
            }
            else
            {
                existing.Balance += ukb.Balance;
                existing.UpdatedAt = DateTime.Now;
                _db.UserKeyBalances.Update(existing);
            }
            _db.SaveChanges();
            return RedirectToAction("Index");
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("is unknown when attempting to save changes"))
        {
            ViewBag.ErrorMessage = "請勿空值";
            return View(ukb);
        }
        catch (DbUpdateException ex)
        {
            ViewBag.ErrorMessage = "未知異常，請重試";
            return View(ukb);
        }
    }


    public ActionResult delete(Guid? userId, Guid? keydefinitionId)
    {
        UserKeyBalance ukb = _db.UserKeyBalances.FirstOrDefault(t => t.UserId == userId && t.KeyDefinitionId == keydefinitionId);
        if (ukb != null)
        {
            _db.UserKeyBalances.Remove(ukb);
            _db.SaveChanges();
        }
        else
        {
            return Content("Id 不存在");
        }
        return RedirectToAction("Index");
    }


    public ActionResult Edit(Guid? userId, Guid? keydefinitionId)
    {
        if (userId == null || keydefinitionId == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            UserKeyBalance kd = _db.UserKeyBalances.FirstOrDefault(t => t.UserId == userId && t.KeyDefinitionId == keydefinitionId);
            data(userId, keydefinitionId);
            return View(kd);
        }
    }

    [HttpPost]
    public ActionResult Edit(UserKeyBalance ukb, Guid? userId, Guid? keydefinitionId)
    {
        UserKeyBalance u = _db.UserKeyBalances.FirstOrDefault(t => t.UserId == userId && t.KeyDefinitionId == keydefinitionId);
        if (userId == null || keydefinitionId == null)
        {
            return Content("Id 不存在");
        }
        else
        {
            try
            {
                u.UserId = ukb.UserId;
                u.KeyDefinitionId = ukb.KeyDefinitionId;
                u.Balance = ukb.Balance;
                u.UpdatedAt = DateTime.Now;
                _db.SaveChanges();
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("is unknown when attempting to save changes"))
            {
                ViewBag.ErrorMessage = "請勿空值";
                return View(ukb);
            }
            catch (DbUpdateException ex)
            {
                ViewBag.ErrorMessage = "未知異常，請重試";
                return View(ukb);
            }
        }
        return RedirectToAction("Index");
    }



    private void data(Guid? userId, Guid? keydefinitionId)
    {
        var uid = _db.UserProfiles.OrderBy(e => e.UserId).ToList();
        var kdid = _db.KeyDefinitions.OrderBy(e => e.Id).ToList();

        ViewBag.UserProfileList = new SelectList(uid, "UserId", "Nickname", userId);
        ViewBag.KeyDefinitionList = new SelectList(kdid, "Id", "Name", keydefinitionId);
    }
}
