using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Store.ViewModels;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Store.Controllers;

[Area("Store")]
[Route("store/product")]
public class ProductController : Controller
{

    private readonly QmahDbContext db;

    public ProductController(QmahDbContext db)
    {
        this.db = db;
    }

    [HttpGet]
    [HttpGet("Index")]
    public IActionResult Index(int page = 0, int rows = 20)
    {
        bool isOverShot = page < 0 || rows < 0 || this.db.Products.Count() < page * rows;
        if (isOverShot) return View(new List<ProductSimplefyListItem>());

        var data = this.db.Products
            .Skip(page * rows).Take(rows)
            .Select(p => new ProductSimplefyListItem(p))
            .ToList();

        ViewData["Page"] = page;
        ViewData["Rows"] = rows;

        return View(data);
    }

    [HttpGet("{id:Guid}")]
    public IActionResult GetProduct(Guid id)
    {
        var product = db.Products.Where(p => p.Id == id).FirstOrDefault();

        return View(product);
    }
}
