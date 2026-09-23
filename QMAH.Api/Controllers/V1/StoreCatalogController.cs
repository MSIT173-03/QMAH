using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/store")]
// integration: Store 先接上資料庫已有的商品、評論與媒體路徑；首頁行銷 mock 沒有對應後端時不在此控制器虛構資料。
public sealed class StoreCatalogController(
    QmahDbContext db,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    public enum OrderType
    {
        None,
        HotSell,
        Older,
        Newer,
        CheaperFirst,
        PricierFirst,
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<StoreCategoryDto>>> GetCategories(
        CancellationToken cancellationToken = default)
    {
        // integration: 分類入口是既有 Store UI 的正式資料，不再使用 mock-db 的固定件數；
        // 件數與商品列表共用 IsActive 條件，避免下架商品仍出現在分類統計中。
        var categories = await db.ArtifactCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .Select(category => new StoreCategoryDto(
                category.Id,
                category.Code,
                category.Name,
                db.Products.Count(product => product.IsActive && product.CategoryCode == category.Code)))
            .ToListAsync(cancellationToken);

        return Ok(categories);
    }

    [HttpGet("eras")]
    public async Task<ActionResult<IReadOnlyList<StoreEraDto>>> GetEras(
        CancellationToken cancellationToken = default)
    {
        // 商品本身沒有年代欄位，年代取自對應文物；件數與商品列表的 eraCode 篩選共用同一條關聯。
        var eras = await db.EraBuckets
            .AsNoTracking()
            .OrderBy(era => era.StartYear)
            .ThenBy(era => era.Name)
            .Select(era => new StoreEraDto(
                era.Id,
                era.Code,
                era.Name,
                db.Products.Count(product => product.IsActive
                    && product.Artifact != null
                    && product.Artifact.EraBucketId == era.Id)))
            .ToListAsync(cancellationToken);

        return Ok(eras);
    }

    [HttpGet("promotions")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<StorePromotionDto>>> GetPromotions(
        CancellationToken cancellationToken = default)
    {
        // 商城與社群共用同一份官方商城公告，避免優惠券條件在兩個資料來源各維護一次。
        // 公告內容只作展示；實際折扣與可用性仍由結帳流程重新驗證優惠券定義。
        var promotions = await db.SocialPosts
            .AsNoTracking()
            .Where(post => post.Status == "PUBLISHED"
                && post.PostType == "ANNOUNCEMENT"
                && post.PublisherType == "OFFICIAL"
                && post.BoardCode == "STORE")
            .OrderByDescending(post => post.CreatedAt)
            .ThenBy(post => post.Id)
            .Select(post => new StorePromotionDto(
                post.Id,
                post.Title,
                post.Content,
                post.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(promotions);
    }

    [HttpGet("products")]
    public async Task<ActionResult<ApiPage<ProductListItemDto>>> GetProducts(
        string? q,
        string? categoryCode,
        string? eraCode,
        Guid? artifactId,
        decimal? maxPrice,
        decimal? minPrice,
        bool? dealOnly,
        OrderType order = OrderType.None,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.Products
            .AsNoTracking()
            .Where(product => product.IsActive);
        q = q?.Trim();
        categoryCode = categoryCode?.Trim().ToUpperInvariant();
        eraCode = eraCode?.Trim().ToUpperInvariant();

        // 篩選
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(product =>
                product.Name.Contains(q)
                || (product.ExternalRef != null && product.ExternalRef.Contains(q)));

        if (!string.IsNullOrWhiteSpace(categoryCode))
            query = query.Where(product => product.CategoryCode == categoryCode);
        if (!string.IsNullOrWhiteSpace(eraCode))
            query = query.Where(product => product.Artifact != null && product.Artifact.EraBucket.Code == eraCode);
        if (artifactId.HasValue)
            query = query.Where(product => product.ArtifactId == artifactId.Value);

        // integration: 限時特賣接受有效單品售價或真正大於 0 的商品折扣率，不以前端標籤推測。
        if (dealOnly == true)
            query = query.Where(product =>
                (product.SalePrice.HasValue
                    && product.SalePrice.Value > 0m
                    && product.SalePrice.Value < product.Price)
                || product.DiscountRate > 0m);

        if (minPrice is not null and > 0)
            query = query.Where(p =>
                (p.SalePrice.HasValue
                    && p.SalePrice.Value > 0m
                    && p.SalePrice.Value < p.Price
                    ? p.SalePrice.Value
                    : Math.Round(p.Price * (100m - p.DiscountRate) / 100m, 2)) >= minPrice);
        if (maxPrice is not null and > 0)
            query = query.Where(p =>
                (p.SalePrice.HasValue
                    && p.SalePrice.Value > 0m
                    && p.SalePrice.Value < p.Price
                    ? p.SalePrice.Value
                    : Math.Round(p.Price * (100m - p.DiscountRate) / 100m, 2)) < maxPrice);

        var query2 = query.Select(g => new
        {
            g.Id,
            g.ArtifactId,
            g.ExternalRef,
            g.Name,
            g.CategoryCode,
            g.Price,
            g.DiscountRate,
            EffectivePrice = g.SalePrice.HasValue
                && g.SalePrice.Value > 0m
                && g.SalePrice.Value < g.Price
                ? g.SalePrice.Value
                : Math.Round(g.Price * (100m - g.DiscountRate) / 100m, 2),
            SalePrice = g.SalePrice.HasValue
                && g.SalePrice.Value > 0m
                && g.SalePrice.Value < g.Price
                ? g.SalePrice
                : g.DiscountRate > 0m
                    ? Math.Round(g.Price * (100m - g.DiscountRate) / 100m, 2)
                    : (decimal?)null,
            g.Stock,
            PrimaryImagePath = g.PrimaryImagePath ?? (g.Artifact == null ? null : g.Artifact.PrimaryImagePath),
            g.CreatedAt,
            AverageRating = db.ProductReviews
                    .Where(r => r.ProductId == g.Id && r.Status == "PUBLISHED")
                    .Average(r => (decimal?)r.Rating) ?? 0m,
            ReviewCount = db.ProductReviews
                    .Count(r => r.ProductId == g.Id && r.Status == "PUBLISHED"),
            SellCount = db.OrderDetails
                    .Where(o => o.ProductId == g.Id && db.StoreOrders.Where(s => s.Id == o.OrderId && s.Status == "COMPLETED").Any())
                    .Sum(o => o.Quantity)
        });

        // 排序
        var query3 = order switch
        {
            OrderType.HotSell => query2
                .OrderByDescending(g => g.SellCount)
                .ThenBy(g => g.Id),
            OrderType.Older => query2
                .OrderBy(g => g.CreatedAt)
                .ThenBy(g => g.Id),
            OrderType.Newer => query2
                .OrderByDescending(g => g.CreatedAt)
                .ThenBy(g => g.Id),
            OrderType.CheaperFirst => query2
                .OrderBy(g => g.EffectivePrice)
                .ThenBy(g => g.Id),
            OrderType.PricierFirst => query2
                .OrderByDescending(g => g.EffectivePrice)
                .ThenBy(g => g.Id),
            _ => query2.OrderBy(g => g.Id),
        };

        var res = query3.Select(g => new ProductListItemDto(
            g.Id,
            g.ArtifactId,
            g.ExternalRef,
            g.Name,
            g.CategoryCode,
            g.Price,
            g.DiscountRate,
            g.EffectivePrice,
            g.SalePrice,
            g.Stock,
            g.PrimaryImagePath,
            g.CreatedAt,
            g.AverageRating,
            g.ReviewCount,
            g.SellCount
        ));

        var result = await ApiPaging.ToPageAsync(res, page, pageSize, cancellationToken);

        // 原本直接回傳資料庫中的 PrimaryImagePath；棄用原因：CDN 模式需要統一轉換公開圖片網址。
        return Ok(result with
        {
            Items = result.Items
                .Select(item => item with
                {
                    PrimaryImagePath = mediaUrlResolver.Resolve(item.PrimaryImagePath)
                })
                .ToList()
        });
    }

    [HttpGet("products/{id:guid}")]
    public async Task<ActionResult<ProductDetailsDto>> GetProduct(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .AsNoTracking()
            .Where(item => item.Id == id && item.IsActive)
            .Select(item => new ProductDetailsDto(
                item.Id,
                item.ArtifactId,
                item.Artifact == null ? null : item.Artifact.ArtifactRef,
                item.Artifact == null ? null : item.Artifact.Name,
                item.ExternalRef,
                item.Name,
                item.CategoryCode,
                item.Description,
                item.SizeText,
                // 同時提供關聯文物原始尺寸；商品尺寸不再承擔兩種語意。
                item.Artifact == null ? null : item.Artifact.SizeText,
                item.Price,
                item.DiscountRate,
                item.SalePrice.HasValue
                    && item.SalePrice.Value > 0m
                    && item.SalePrice.Value < item.Price
                    ? item.SalePrice.Value
                    : Math.Round(item.Price * (100m - item.DiscountRate) / 100m, 2),
                item.SalePrice.HasValue
                    && item.SalePrice.Value > 0m
                    && item.SalePrice.Value < item.Price
                    ? item.SalePrice
                    : item.DiscountRate > 0m
                        ? Math.Round(item.Price * (100m - item.DiscountRate) / 100m, 2)
                        : (decimal?)null,
                item.Stock,
                item.PrimaryImagePath ?? (item.Artifact == null ? null : item.Artifact.PrimaryImagePath),
                item.SourceUrl,
                item.IsActive,
                item.ProductReviews
                    .Where(review => review.Status == "PUBLISHED")
                    .Select(review => (decimal?)review.Rating)
                    .Average() ?? 0m,
                item.ProductReviews.Count(review => review.Status == "PUBLISHED")))
            .SingleOrDefaultAsync(cancellationToken);

        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        // 原本直接回傳 PrimaryImagePath；棄用原因：資料庫只保存邏輯路徑，公開來源由部署設定決定。
        return Ok(product with
        {
            PrimaryImagePath = mediaUrlResolver.Resolve(product.PrimaryImagePath)
        });
    }
}
