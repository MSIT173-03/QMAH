using Microsoft.AspNetCore.Mvc;
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

        var data = await db.Products
            .AsNoTracking()
            .OrderByDescending(product => product.IsActive)
            .ThenBy(product => product.Name)
            .Skip(page * rows)
            .Take(rows)
            .Select(product => new ProductSimplefyListItem(product))
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
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        return product is null ? NotFound() : View(product);
    }

    [HttpGet("Create")]
    public IActionResult Create()
    {
        return View("ProductEdit", new ProductEditViewModel());
    }

    [HttpPost("Create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        ProductEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
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

        return View("ProductEdit", ToEditModel(product));
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
