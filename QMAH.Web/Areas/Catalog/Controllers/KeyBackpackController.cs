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
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[AdminNavigation("鑰匙背包", order: 30)]
public class KeyBackPackController : Controller
{
    private readonly QmahDbContext _db;
    private readonly EconomyService _economyService;

    public KeyBackPackController(QmahDbContext db, EconomyService economyService)
    {
        _db = db;
        _economyService = economyService;
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
        return RedirectToAction(nameof(Adjust), new { userId, keyDefinitionId = keydefinitionId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Create(UserKeyBalance ukb, Guid userId, Guid keydefinitionId)
    {
        // 原本 Create 會直接寫入 UserKeyBalance；現改由 Adjust Service 建立交易紀錄，避免後台改餘額卻沒有流水。
        return BadRequest("請改用含調整原因的鑰匙異動頁面。");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public ActionResult Delete(Guid? userId, Guid? keydefinitionId)
    {
        // UserKeyBalance 是目前餘額，不是可刪除的歷史紀錄；正常後台不提供物理刪除入口。
        return BadRequest("鑰匙餘額不可直接刪除，請使用含原因的扣除操作。");
    }

    public ActionResult Edit(Guid? userId, Guid? keydefinitionId)
    {
        return userId.HasValue && keydefinitionId.HasValue
            ? RedirectToAction(nameof(Adjust), new { userId, keyDefinitionId = keydefinitionId })
            : BadRequest("缺少會員或鑰匙識別碼。");
    }

    [HttpPost]
    public ActionResult Edit(
        UserKeyBalance ukb,
        Guid? userId,
        Guid? keydefinitionId)
    {
        // 原本 Edit 允許任意覆寫 Balance；現保留舊路由但拒絕直接寫入，避免繞過交易與非負數檢查。
        return BadRequest("鑰匙餘額不可直接覆寫，請使用含原因的增減操作。");
    }

    [HttpGet]
    public async Task<IActionResult> Adjust(
        Guid userId,
        Guid keyDefinitionId,
        CancellationToken cancellationToken = default)
    {
        var model = await BuildAdjustModelAsync(userId, keyDefinitionId, cancellationToken);
        return model is null ? NotFound() : View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Adjust(
        KeyAdjustViewModel model,
        CancellationToken cancellationToken = default)
    {
        var current = await BuildAdjustModelAsync(model.UserId, model.KeyDefinitionId, cancellationToken);
        if (current is null)
            return NotFound();

        if (!ModelState.IsValid || model.Amount == 0)
        {
            if (model.Amount == 0)
                ModelState.AddModelError(nameof(model.Amount), "調整數量不可為 0。");
            CopyDisplayFields(current, model);
            return View(model);
        }

        var result = await _economyService.AdjustKeysAsync(
            model.UserId,
            model.KeyDefinitionId,
            model.Amount,
            model.Reason,
            cancellationToken: cancellationToken);
        if (!result.Succeeded)
        {
            ModelState.AddModelError(string.Empty, result.ErrorMessage ?? "鑰匙異動失敗。");
            CopyDisplayFields(current, model);
            return View(model);
        }

        TempData["SuccessMessage"] = "鑰匙餘額已調整，並已留下鑰匙流水。";
        return RedirectToAction(nameof(Index), new { userId = model.UserId });
    }

    private async Task<KeyAdjustViewModel?> BuildAdjustModelAsync(
        Guid userId,
        Guid keyDefinitionId,
        CancellationToken cancellationToken)
    {
        var row = await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking()
                on user.Id equals profile.UserId into profiles
            from profile in profiles.DefaultIfEmpty()
            join key in _db.KeyDefinitions.AsNoTracking()
                on keyDefinitionId equals key.Id
            join balance in _db.UserKeyBalances.AsNoTracking()
                on new { UserId = user.Id, KeyDefinitionId = key.Id }
                equals new { balance.UserId, balance.KeyDefinitionId } into balances
            from balance in balances.DefaultIfEmpty()
            where user.Id == userId && key.IsActive
            select new KeyAdjustViewModel
            {
                UserId = user.Id,
                KeyDefinitionId = key.Id,
                MemberName = profile != null && profile.Nickname != null ? profile.Nickname : user.Email ?? "未命名會員",
                KeyName = key.Name,
                KeyCode = key.Code,
                CurrentBalance = balance == null ? 0 : balance.Balance
            })
            .FirstOrDefaultAsync(cancellationToken);
        return row;
    }

    private static void CopyDisplayFields(KeyAdjustViewModel source, KeyAdjustViewModel target)
    {
        target.MemberName = source.MemberName;
        target.KeyName = source.KeyName;
        target.KeyCode = source.KeyCode;
        target.CurrentBalance = source.CurrentBalance;
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
