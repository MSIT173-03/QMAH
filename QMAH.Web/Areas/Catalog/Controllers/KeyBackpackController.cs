using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Vml.Spreadsheet;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("鑰匙背包", order: 30)]
public class KeyBackPackController : Controller
{
    private readonly QmahDbContext _db;

    public KeyBackPackController(QmahDbContext db)
    {
        _db = db;
    }

    public async Task<ActionResult> Index(
        C_KeywordViewModel vm,
        Guid? userId,
        CancellationToken cancellationToken)
    {
        vm.txtKeyword = vm.txtKeyword?.Trim();

        if (!userId.HasValue)
        {
            var ownerRows = await (
                from u in _db.UserProfiles.AsNoTracking()
                join b in _db.UserKeyBalances.AsNoTracking()
                    on u.UserId equals b.UserId into balances
                select new UserKeyOwnerSummaryViewModel
                {
                    UserId = u.UserId,
                    Nickname = u.Nickname,
                    KeyTypeCount = balances.Count(),
                    TotalBalance = balances.Sum(x => (int?)x.Balance) ?? 0
                })
                .OrderBy(x => x.Nickname)
                .ToListAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(vm.txtKeyword))
            {
                ownerRows = ownerRows
                    .Where(x =>
                        (x.Nickname ?? "").Contains(
                            vm.txtKeyword,
                            StringComparison.OrdinalIgnoreCase) ||
                        x.UserId.ToString().Contains(
                            vm.txtKeyword,
                            StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            ViewBag.Keyword = vm.txtKeyword;
            ViewBag.OwnerSummaries = ownerRows;

            return View(Array.Empty<UserKeyBalanceViewModel>());
        }

        var ukb = await _db.UserKeyBalances
            .AsNoTracking()
            .Include(x => x.KeyDefinition)
            .Where(x => x.UserId == userId.Value)
            .OrderBy(x => x.KeyDefinition.Name)
            .ToListAsync(cancellationToken);

        var profile = await _db.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == userId.Value,
                cancellationToken);

        var nickname = profile?.Nickname ?? "未命名會員";

        var datas_ukb = ukb
            .Select(x => new UserKeyBalanceViewModel
            {
                UserKeyBalance = x,
                Nickname = nickname
            })
            .ToList();

        ViewBag.SelectedUserId = userId.Value;
        ViewBag.SelectedNickname = nickname;

        return View(datas_ukb);
    }

    public ActionResult Create(Guid userId, Guid keydefinitionId)
    {
        data(userId, keydefinitionId);
        ViewBag.ReturnUserId = userId;
        return View();
    }

    [HttpPost]
    public ActionResult Create(UserKeyBalance ukb, Guid userId, Guid keydefinitionId)
    {
        try
        {
            data(userId, keydefinitionId);
            ViewBag.ReturnUserId = userId;

            var existing = _db.UserKeyBalances
                .FirstOrDefault(x =>
                    x.UserId == userId &&
                    x.KeyDefinitionId == keydefinitionId);

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

            return RedirectToAction("Index", new { userId });
        }
        catch (InvalidOperationException ex)
            when (ex.Message.Contains("is unknown when attempting to save changes"))
        {
            ViewBag.ErrorMessage = "請勿空值";
            ViewBag.ReturnUserId = userId;
            return View(ukb);
        }
        catch (DbUpdateException)
        {
            ViewBag.ErrorMessage = "未知異常，請重試";
            ViewBag.ReturnUserId = userId;
            return View(ukb);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? userId, Guid? keydefinitionId)
    {
        UserKeyBalance? ukb = _db.UserKeyBalances
            .FirstOrDefault(t =>
                t.UserId == userId &&
                t.KeyDefinitionId == keydefinitionId);

        if (ukb != null)
        {
            _db.UserKeyBalances.Remove(ukb);
            _db.SaveChanges();
        }
        else
        {
            return Content("Id 不存在");
        }

        return RedirectToAction("Index", new { userId });
    }

    public ActionResult Edit(Guid? userId, Guid? keydefinitionId)
    {
        if (userId == null || keydefinitionId == null)
        {
            return Content("Id 不存在");
        }

        UserKeyBalance? kd = _db.UserKeyBalances
            .FirstOrDefault(t =>
                t.UserId == userId &&
                t.KeyDefinitionId == keydefinitionId);

        if (kd == null)
        {
            return Content("Id 不存在");
        }

        data(userId, keydefinitionId);
        ViewBag.ReturnUserId = userId;

        return View(kd);
    }

    [HttpPost]
    public ActionResult Edit(
        UserKeyBalance ukb,
        Guid? userId,
        Guid? keydefinitionId)
    {
        if (userId == null || keydefinitionId == null)
        {
            return Content("Id 不存在");
        }

        UserKeyBalance? u = _db.UserKeyBalances
            .FirstOrDefault(t =>
                t.UserId == userId &&
                t.KeyDefinitionId == keydefinitionId);

        if (u == null)
        {
            return Content("Id 不存在");
        }

        try
        {
            u.UserId = ukb.UserId;
            u.KeyDefinitionId = ukb.KeyDefinitionId;
            u.Balance = ukb.Balance;
            u.UpdatedAt = DateTime.Now;
            _db.SaveChanges();
        }
        catch (InvalidOperationException ex)
            when (ex.Message.Contains("is unknown when attempting to save changes"))
        {
            ViewBag.ErrorMessage = "請勿空值";
            ViewBag.ReturnUserId = userId;
            return View(ukb);
        }
        catch (DbUpdateException)
        {
            ViewBag.ErrorMessage = "未知異常，請重試";
            ViewBag.ReturnUserId = userId;
            return View(ukb);
        }

        return RedirectToAction("Index", new { userId = ukb.UserId });
    }

    private void data(Guid? userId, Guid? keydefinitionId)
    {
        var uid = _db.UserProfiles
            .OrderBy(e => e.UserId)
            .ToList();

        var kdid = _db.KeyDefinitions
            .OrderBy(e => e.Id)
            .ToList();

        ViewBag.UserProfileList =
            new SelectList(uid, "UserId", "Nickname", userId);

        ViewBag.KeyDefinitionList =
            new SelectList(kdid, "Id", "Name", keydefinitionId);
    }
}
