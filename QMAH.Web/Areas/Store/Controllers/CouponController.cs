using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[Route("store/coupon")]
[AdminNavigation("優惠券規則", 30)]
public class CouponController : Controller
{
    private readonly QmahDbContext db;

    public CouponController(QmahDbContext db)
    {
        this.db = db;
    }

    [HttpGet]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(CancellationToken cancellationToken = default)
    {
        var coupons = await db.CouponDefinitions
            .AsNoTracking()
            .OrderByDescending(coupon => coupon.IsActive)
            .ThenByDescending(coupon => coupon.EndAt)
            .ToListAsync(cancellationToken);

        return View(coupons);
    }

    [HttpGet("Create")]
    public IActionResult Create()
    {
        return View("CouponEdit", new CouponEditViewModel());
    }

    [HttpPost("Create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        CouponEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        Normalize(model);
        if (model.EndAt <= model.StartAt)
        {
            ModelState.AddModelError(nameof(model.EndAt), "結束時間必須晚於開始時間。");
        }

        await ValidateCouponDefinitionAsync(model, cancellationToken);

        if (!ModelState.IsValid)
        {
            return View("CouponEdit", model);
        }

        db.CouponDefinitions.Add(new CouponDefinition
        {
            Id = Guid.NewGuid(),
            Code = model.Code,
            Name = model.Name,
            DiscountType = model.DiscountType,
            AcquisitionType = model.AcquisitionType,
            PointCost = model.PointCost,
            ValidityDays = model.ValidityDays,
            DiscountValue = model.DiscountValue,
            MinimumAmount = model.MinimumAmount,
            StartAt = model.StartAt,
            EndAt = model.EndAt,
            IsActive = model.IsActive
        });

        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "優惠券規則已建立。";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("Edit/{id:Guid}")]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var coupon = await db.CouponDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return coupon is null ? NotFound() : View("CouponEdit", ToEditModel(coupon));
    }

    [HttpPost("Edit/{id:Guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        CouponEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        Normalize(model);
        if (model.EndAt <= model.StartAt)
        {
            ModelState.AddModelError(nameof(model.EndAt), "結束時間必須晚於開始時間。");
        }

        await ValidateCouponDefinitionAsync(model, cancellationToken, id);

        if (!ModelState.IsValid)
        {
            return View("CouponEdit", model);
        }

        var coupon = await db.CouponDefinitions.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (coupon is null)
        {
            return NotFound();
        }

        coupon.Code = model.Code;
        coupon.Name = model.Name;
        coupon.DiscountType = model.DiscountType;
        coupon.AcquisitionType = model.AcquisitionType;
        coupon.PointCost = model.PointCost;
        coupon.ValidityDays = model.ValidityDays;
        coupon.DiscountValue = model.DiscountValue;
        coupon.MinimumAmount = model.MinimumAmount;
        coupon.StartAt = model.StartAt;
        coupon.EndAt = model.EndAt;
        coupon.IsActive = model.IsActive;

        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "優惠券規則已更新。";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("ToggleStatus")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleStatus(Guid id, CancellationToken cancellationToken = default)
    {
        var coupon = await db.CouponDefinitions.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (coupon is null)
        {
            return NotFound();
        }

        coupon.IsActive = !coupon.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = coupon.IsActive ? "優惠券規則已啟用。" : "優惠券規則已停用。";
        return RedirectToAction(nameof(Index));
    }

    private static void Normalize(CouponEditViewModel model)
    {
        model.Code = model.Code?.Trim().ToUpperInvariant() ?? "";
        model.Name = model.Name?.Trim() ?? "";
        model.DiscountType = model.DiscountType?.Trim().ToUpperInvariant() ?? "";
        model.AcquisitionType = model.AcquisitionType?.Trim().ToUpperInvariant() ?? "";

        if (model.AcquisitionType == "ADMIN_GRANT")
        {
            model.PointCost = null;
        }
    }

    private async Task ValidateCouponDefinitionAsync(
        CouponEditViewModel model,
        CancellationToken cancellationToken,
        Guid? editingId = null)
    {
        if (model.AcquisitionType is not ("POINT_EXCHANGE" or "ADMIN_GRANT"))
        {
            ModelState.AddModelError(nameof(model.AcquisitionType), "取得方式必須是點數兌換或管理員發放。");
        }

        if (model.AcquisitionType == "POINT_EXCHANGE" && (!model.PointCost.HasValue || model.PointCost.Value <= 0))
        {
            ModelState.AddModelError(nameof(model.PointCost), "點數兌換券必須設定大於 0 的點數成本。");
        }

        if (model.AcquisitionType == "ADMIN_GRANT" && model.PointCost.HasValue)
        {
            ModelState.AddModelError(nameof(model.PointCost), "管理員發放券不應設定點數成本。");
        }

        if (model.DiscountType == "PERCENT" && model.DiscountValue > 100)
        {
            ModelState.AddModelError(nameof(model.DiscountValue), "百分比折扣不可超過 100%。");
        }

        var duplicateCode = await db.CouponDefinitions
            .AsNoTracking()
            .AnyAsync(item => item.Code == model.Code && (!editingId.HasValue || item.Id != editingId.Value), cancellationToken);
        if (duplicateCode)
        {
            ModelState.AddModelError(nameof(model.Code), "優惠券代碼已存在，請改用其他代碼。");
        }
    }

    private static CouponEditViewModel ToEditModel(CouponDefinition coupon) => new()
    {
        Id = coupon.Id,
        Code = coupon.Code,
        Name = coupon.Name,
        DiscountType = coupon.DiscountType,
        AcquisitionType = coupon.AcquisitionType,
        PointCost = coupon.PointCost,
        ValidityDays = coupon.ValidityDays,
        DiscountValue = coupon.DiscountValue,
        MinimumAmount = coupon.MinimumAmount,
        StartAt = coupon.StartAt,
        EndAt = coupon.EndAt,
        IsActive = coupon.IsActive
    };
}
