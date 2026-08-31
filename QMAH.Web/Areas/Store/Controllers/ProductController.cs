using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;

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
        string? search,
        string? sort,
        string? direction,
        int page = 1,
        int rows = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        rows = NormalizePageSize(rows);
        search = search?.Trim();
        sort = NormalizeSort(sort);
        direction = string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase)
            ? "desc"
            : "asc";

        var query =
            from product in db.Products.AsNoTracking()
            join category in db.ArtifactCategories.AsNoTracking()
                on product.CategoryCode equals category.Code into categoryGroup
            from category in categoryGroup.DefaultIfEmpty()
            select new
            {
                Product = product,
                CategoryName = category != null ? category.Name : product.CategoryCode,
                ArtifactName = product.Artifact != null ? product.Artifact.Name : null
            };

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(item =>
                item.Product.Name.Contains(search) ||
                (item.Product.ExternalRef != null && item.Product.ExternalRef.Contains(search)) ||
                item.Product.CategoryCode.Contains(search) ||
                item.CategoryName.Contains(search) ||
                (item.ArtifactName != null && item.ArtifactName.Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)rows));
        page = Math.Min(page, totalPages);

        query = (sort, direction) switch
        {
            ("name", "desc") => query.OrderByDescending(item => item.Product.Name),
            ("name", _) => query.OrderBy(item => item.Product.Name),
            ("category", "desc") => query.OrderByDescending(item => item.CategoryName).ThenBy(item => item.Product.Name),
            ("category", _) => query.OrderBy(item => item.CategoryName).ThenBy(item => item.Product.Name),
            ("price", "desc") => query.OrderByDescending(item => item.Product.Price).ThenBy(item => item.Product.Name),
            ("price", _) => query.OrderBy(item => item.Product.Price).ThenBy(item => item.Product.Name),
            ("stock", "desc") => query.OrderByDescending(item => item.Product.Stock).ThenBy(item => item.Product.Name),
            ("stock", _) => query.OrderBy(item => item.Product.Stock).ThenBy(item => item.Product.Name),
            ("status", "desc") => query.OrderByDescending(item => item.Product.IsActive).ThenBy(item => item.Product.Name),
            ("status", _) => query.OrderBy(item => item.Product.IsActive).ThenBy(item => item.Product.Name),
            _ => query.OrderByDescending(item => item.Product.IsActive).ThenBy(item => item.Product.Name)
        };

        var data = await query
            .Skip((page - 1) * rows)
            .Take(rows)
            .Select(item => new ProductSimplefyListItem
            {
                Id = item.Product.Id,
                Name = item.Product.Name,
                Category = item.CategoryName,
                Price = item.Product.Price,
                Stock = item.Product.Stock,
                ImageUrl = item.Product.PrimaryImagePath ?? string.Empty,
                IsActive = item.Product.IsActive
            })
            .ToListAsync(cancellationToken);

        ViewData["Search"] = search;
        ViewData["Sort"] = sort;
        ViewData["Direction"] = direction;
        ViewData["Page"] = page;
        ViewData["Rows"] = rows;
        ViewData["TotalCount"] = totalCount;
        ViewData["TotalPages"] = totalPages;

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
    public async Task<IActionResult> ToggleStatus(
        Guid id,
        string? search,
        string? sort,
        string? direction,
        int page = 1,
        int rows = 20,
        CancellationToken cancellationToken = default)
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

        return RedirectToAction(nameof(Index), new
        {
            search,
            sort,
            direction,
            page,
            rows
        });
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

    private static int NormalizePageSize(int rows) =>
        rows is 10 or 20 or 50 or 100 ? rows : 20;

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "name" or "category" or "price" or "stock" or "status" => sort.Trim().ToLowerInvariant(),
        _ => "default"
    };

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
