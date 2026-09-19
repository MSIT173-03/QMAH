using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/store")]
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

    public enum CategoryType
    {
        BRONZE,
        CARVING,
        CERAMIC,
        COIN,
        ENAMEL,
        JADE,
        LACQUER,
        PAINTING,
    }

    [HttpGet("products")]
    public async Task<ActionResult<ApiPage<ProductListItemDto>>> GetProducts(
        string? q,
        string? categoryCode,
        Guid? artifactId,
        decimal? maxPrice,
        decimal? minPrice,
        CategoryType? category,
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

        // 篩選
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(product =>
                product.Name.Contains(q)
                || (product.ExternalRef != null && product.ExternalRef.Contains(q)));

        if (!string.IsNullOrWhiteSpace(categoryCode))
            query = query.Where(product => product.CategoryCode == categoryCode);
        if (artifactId.HasValue)
            query = query.Where(product => product.ArtifactId == artifactId.Value);

        if (minPrice is not null and > 0)
            query = query.Where(p => p.Price >= minPrice);
        if (maxPrice is not null and > 0)
            query = query.Where(p => p.Price < maxPrice);

        if (category is { } categoryType)
        {
            var code = categoryType.ToString();
            query = query.Where(p => p.CategoryCode == code);
        }

        var query2 = query.Select(g => new
        {
            g.Id,
            g.ArtifactId,
            g.ExternalRef,
            g.Name,
            g.CategoryCode,
            g.Price,
            g.Stock,
            g.PrimaryImagePath,
            g.CreatedAt,
            AverageRating = db.ProductReviews
                    .Where(r => r.ProductId == g.Id && r.Status == "PUBLISHED")
                    .Average(r => (decimal?)r.Rating) ?? 0m,
            ReviewCount = db.ProductReviews
                    .Count(r => r.ProductId == g.Id && r.Status == "PUBLISHED"),
            SellCount = db.OrderDetails
                    .Where(o => o.ProductId == g.Id && o.Order.Status == "COMPLETED")
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
                .OrderBy(g => g.Price)
                .ThenBy(g => g.Id),
            OrderType.PricierFirst => query2
                .OrderByDescending(g => g.Price)
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

    /// <summary>取得八種商品類型的數量；已登入時一併附上點數與優惠券列表。</summary>
    [HttpGet("products/info")]
    public async Task<ActionResult<ProductInfomationDto>> GetProductInfo(
        CancellationToken cancellationToken = default)
    {
        var products = await db.Products
            .AsNoTracking()
            .Where(product => product.IsActive)
            .Select(product => new ProductListItemDto(
                product.Id,
                product.ArtifactId,
                product.ExternalRef,
                product.Name,
                product.CategoryCode,
                product.Price,
                product.Stock,
                product.PrimaryImagePath,
                product.CreatedAt,
                product.ProductReviews
                    .Where(review => review.Status == "PUBLISHED")
                    .Select(review => (decimal?)review.Rating)
                    .Average() ?? 0m,
                product.ProductReviews.Count(review => review.Status == "PUBLISHED"),
                product.OrderDetails
                    .Where(detail => detail.Order.Status == "COMPLETED")
                    .Sum(detail => detail.Quantity)))
            .ToListAsync(cancellationToken);

        var byCategory = products.ToLookup(product => product.CategoryCode);
        var categoryCounts = Enum.GetNames<CategoryType>()
            .ToDictionary(name => name, name => byCategory[name].Count());
        var categoryCoverImages = Enum.GetNames<CategoryType>()
            .ToDictionary(
                name => name,
                name => mediaUrlResolver.Resolve(byCategory[name]
                    .OrderByDescending(product => product.SellCount)
                    .ThenBy(product => product.Id)
                    .FirstOrDefault()?.PrimaryImagePath));
        var hotProducts = WithPublicImages(products
            .OrderByDescending(product => product.SellCount)
            .ThenBy(product => product.Id)
            .Take(10));
        var newProducts = WithPublicImages(products
            .OrderByDescending(product => product.CreatedAt)
            .ThenBy(product => product.Id)
            .Take(4));
        var topRatedProducts = WithPublicImages(products
            .Where(product => product.ReviewCount > 0)
            .OrderByDescending(product => product.AverageRating)
            .ThenByDescending(product => product.ReviewCount)
            .ThenBy(product => product.Id)
            .Take(4));
        var recommendedProducts = WithPublicImages(products
            .OrderBy(_ => Random.Shared.Next())
            .Take(10));

        if (!TryGetCurrentUserId(out var userId))
            return Ok(new ProductInfomationDto(
                categoryCounts, categoryCoverImages, false, null, null, hotProducts, newProducts, topRatedProducts, recommendedProducts));

        var pointBalance = await db.PointBalances
            .AsNoTracking()
            .Where(balance => balance.UserId == userId)
            .Select(balance => (int?)balance.Balance)
            .SingleOrDefaultAsync(cancellationToken) ?? 0;
        var now = DateTime.UtcNow;
        var coupons = await db.UserCoupons
            .AsNoTracking()
            .Where(coupon => coupon.UserId == userId
                && coupon.Status == "AVAILABLE"
                && coupon.ExpiresAt > now
                && coupon.CouponDefinition.IsActive
                && coupon.CouponDefinition.StartAt <= now
                && coupon.CouponDefinition.EndAt > now)
            .OrderByDescending(coupon => coupon.IssuedAt)
            .Select(coupon => new CouponDto(
                coupon.Id,
                coupon.CouponDefinition.Code,
                coupon.CouponDefinition.Name,
                coupon.CouponDefinition.AcquisitionType,
                coupon.CouponDefinition.PointCost,
                coupon.CouponDefinition.DiscountType,
                coupon.CouponDefinition.DiscountValue,
                coupon.CouponDefinition.MinimumAmount,
                coupon.CouponDefinition.StartAt,
                coupon.CouponDefinition.EndAt,
                "AVAILABLE",
                coupon.IssuedAt,
                coupon.ExpiresAt,
                coupon.UsedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ProductInfomationDto(
            categoryCounts, categoryCoverImages, true, pointBalance, coupons, hotProducts, newProducts, topRatedProducts, recommendedProducts));
    }

    /// <summary>圖片網址統一經 CDN 解析後轉為清單。</summary>
    private IReadOnlyList<ProductListItemDto> WithPublicImages(IEnumerable<ProductListItemDto> items) =>
        items
            .Select(item => item with { PrimaryImagePath = mediaUrlResolver.Resolve(item.PrimaryImagePath) })
            .ToList();

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
                item.Price,
                item.Stock,
                item.PrimaryImagePath,
                item.SourceUrl,
                item.IsActive,
                item.ProductReviews
                    .Where(review => review.Status == "PUBLISHED")
                    .Select(review => (decimal?)review.Rating)
                    .Average() ?? 0m,
                item.ProductReviews.Count(review => review.Status == "PUBLISHED")))
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        // 原本直接回傳 PrimaryImagePath；棄用原因：資料庫只保存邏輯路徑，公開來源由部署設定決定。
        return Ok(product with
        {
            PrimaryImagePath = mediaUrlResolver.Resolve(product.PrimaryImagePath)
        });
    }
}
