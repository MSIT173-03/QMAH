using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
[Route("store/product")]
[AdminNavigation("商品管理", 10)]
public class ProductController : Controller
{
    private readonly QmahDbContext db;

    public ProductController(QmahDbContext db)
    {
        this.db = db;
    }

    [HttpGet]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(
        int page = 0,
        int rows = 20,
        CancellationToken cancellationToken = default)
    {
        if (rows <= 0)
        {
            rows = 20;
        }

        var totalCount = await db.Products.CountAsync(cancellationToken);
        if (page < 0 || totalCount < page * rows)
        {
            return View(new List<ProductSimplefyListItem>());
        }

        var query =
            from product in db.Products.AsNoTracking()
            join category in db.ArtifactCategories.AsNoTracking()
                on product.CategoryCode equals category.Code into categoryGroup
            from category in categoryGroup.DefaultIfEmpty()
            orderby product.IsActive descending, product.Name
            select new ProductSimplefyListItem
            {
                Id = product.Id,
                Name = product.Name,
                Category = category != null ? category.Name : product.CategoryCode,
                Price = product.Price,
                Stock = product.Stock,
                ImageUrl = product.PrimaryImagePath ?? string.Empty,
                IsActive = product.IsActive
            };

        var data = await query
            .Skip(page * rows)
            .Take(rows)
            .ToListAsync(cancellationToken);

        ViewData["Page"] = page;
        ViewData["Rows"] = rows;
        return View(data);
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetProduct(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .AsNoTracking()
            .Include(item => item.Artifact)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        ViewBag.CategoryName = await db.ArtifactCategories
            .AsNoTracking()
            .Where(category => category.Code == product.CategoryCode)
            .Select(category => category.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? product.CategoryCode;

        return View(product);
    }

    [HttpGet("Create")]
    public async Task<IActionResult> Create(CancellationToken cancellationToken = default)
    {
        var model = new ProductEditViewModel();
        await LoadProductOptionsAsync(model.CategoryCode, model.ArtifactId, cancellationToken);
        return View("ProductEdit", model);
    }

    [HttpPost("Create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        ProductEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            await LoadProductOptionsAsync(model.CategoryCode, model.ArtifactId, cancellationToken);
            return View("ProductEdit", model);
        }

        var now = DateTime.UtcNow;
        db.Products.Add(new Product
        {
            Id = Guid.NewGuid(),
            ArtifactId = model.ArtifactId,
            CategoryCode = model.CategoryCode.Trim(),
            ExternalRef = NullIfWhiteSpace(model.ExternalRef),
            Name = model.Name.Trim(),
            Description = NullIfWhiteSpace(model.Description),
            SizeText = NullIfWhiteSpace(model.SizeText),
            Price = model.Price,
            Stock = model.Stock,
            PrimaryImagePath = NullIfWhiteSpace(model.PrimaryImagePath),
            SourceUrl = NullIfWhiteSpace(model.SourceUrl),
            IsActive = model.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "商品已建立。";
        return RedirectToAction(nameof(Index));
    }

    [HttpGet("Edit/{id:Guid}")]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (product is null)
        {
            return NotFound();
        }

        var model = ToEditModel(product);
        await LoadProductOptionsAsync(model.CategoryCode, model.ArtifactId, cancellationToken);
        return View("ProductEdit", model);
    }

    [HttpPost("Edit/{id:Guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        ProductEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            await LoadProductOptionsAsync(model.CategoryCode, model.ArtifactId, cancellationToken);
            return View("ProductEdit", model);
        }

        var product = await db.Products.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        product.ArtifactId = model.ArtifactId;
        product.CategoryCode = model.CategoryCode.Trim();
        product.ExternalRef = NullIfWhiteSpace(model.ExternalRef);
        product.Name = model.Name.Trim();
        product.Description = NullIfWhiteSpace(model.Description);
        product.SizeText = NullIfWhiteSpace(model.SizeText);
        product.Price = model.Price;
        product.Stock = model.Stock;
        product.PrimaryImagePath = NullIfWhiteSpace(model.PrimaryImagePath);
        product.SourceUrl = NullIfWhiteSpace(model.SourceUrl);
        product.IsActive = model.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "商品已更新。";
        return RedirectToAction(nameof(GetProduct), new { id });
    }

    [HttpPost("ToggleStatus")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleStatus(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await db.Products.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        product.IsActive = !product.IsActive;
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        TempData["SuccessMessage"] = product.IsActive
            ? "商品已重新上架。"
            : "商品已下架，既有訂單資料不受影響。";
        return RedirectToAction(nameof(Index));
    }


    private async Task LoadProductOptionsAsync(
        string? categoryCode,
        Guid? artifactId,
        CancellationToken cancellationToken)
    {
        var categories = await db.ArtifactCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .ToListAsync(cancellationToken);

        var artifacts = await db.Artifacts
            .AsNoTracking()
            .Where(artifact => artifact.IsActive || artifact.Id == artifactId)
            .OrderBy(artifact => artifact.Name)
            .Select(artifact => new
            {
                artifact.Id,
                Label = artifact.Name + "（" + artifact.ArtifactRef + "）"
            })
            .ToListAsync(cancellationToken);

        ViewBag.Categories = new SelectList(categories, "Code", "Name", categoryCode);
        ViewBag.Artifacts = new SelectList(artifacts, "Id", "Label", artifactId);
    }

    private static ProductEditViewModel ToEditModel(Product product) => new()
    {
        Id = product.Id,
        ArtifactId = product.ArtifactId,
        CategoryCode = product.CategoryCode,
        ExternalRef = product.ExternalRef,
        Name = product.Name,
        Description = product.Description,
        SizeText = product.SizeText,
        Price = product.Price,
        Stock = product.Stock,
        PrimaryImagePath = product.PrimaryImagePath,
        SourceUrl = product.SourceUrl,
        IsActive = product.IsActive
    };

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
