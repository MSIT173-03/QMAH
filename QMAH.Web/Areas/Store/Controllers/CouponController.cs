using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

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
        model.Code = model.Code.Trim().ToUpperInvariant();
        model.Name = model.Name.Trim();
        model.DiscountType = model.DiscountType.Trim().ToUpperInvariant();
    }

    private static CouponEditViewModel ToEditModel(CouponDefinition coupon) => new()
    {
        Id = coupon.Id,
        Code = coupon.Code,
        Name = coupon.Name,
        DiscountType = coupon.DiscountType,
        DiscountValue = coupon.DiscountValue,
        MinimumAmount = coupon.MinimumAmount,
        StartAt = coupon.StartAt,
        EndAt = coupon.EndAt,
        IsActive = coupon.IsActive
    };
}
