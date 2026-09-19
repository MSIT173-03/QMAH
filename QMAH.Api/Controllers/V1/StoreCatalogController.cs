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

    private string CategoryTypeToString(CategoryType? type) => type switch
    {
        CategoryType.BRONZE => "BRONZE",
        CategoryType.CARVING => "CARVING",
        CategoryType.CERAMIC => "CERAMIC",
        CategoryType.COIN => "COIN",
        CategoryType.ENAMEL => "ENAMEL",
        CategoryType.JADE => "JADE",
        CategoryType.LACQUER => "LACQUER",
        CategoryType.PAINTING => "PAINTING",
        _ => ""
    };

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

        if (category != null)
            query = query.Where(p => p.CategoryCode == CategoryTypeToString(category));

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
        var counted = await db.Products
            .AsNoTracking()
            .Where(product => product.IsActive)
            .GroupBy(product => product.CategoryCode)
            .Select(group => new { Code = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Code, item => item.Count, cancellationToken);
        var categoryCounts = Enum.GetNames<CategoryType>()
            .ToDictionary(name => name, name => counted.GetValueOrDefault(name));

        var rows = db.Products
            .AsNoTracking()
            .Where(product => product.IsActive)
            .Select(g => new ProductRow
            {
                Id = g.Id,
                ArtifactId = g.ArtifactId,
                ExternalRef = g.ExternalRef,
                Name = g.Name,
                CategoryCode = g.CategoryCode,
                Price = g.Price,
                Stock = g.Stock,
                PrimaryImagePath = g.PrimaryImagePath,
                CreatedAt = g.CreatedAt,
                AverageRating = db.ProductReviews
                    .Where(r => r.ProductId == g.Id && r.Status == "PUBLISHED")
                    .Average(r => (decimal?)r.Rating) ?? 0m,
                ReviewCount = db.ProductReviews
                    .Count(r => r.ProductId == g.Id && r.Status == "PUBLISHED"),
                SellCount = db.OrderDetails
                    .Where(o => o.ProductId == g.Id && db.StoreOrders.Where(s => s.Id == o.OrderId && s.Status == "COMPLETED").Any())
                    .Sum(o => o.Quantity)
            });
        var hotProducts = await TakeAsync(
            rows.OrderByDescending(g => g.SellCount).ThenBy(g => g.Id), 10, cancellationToken);
        var newProducts = await TakeAsync(
            rows.OrderByDescending(g => g.CreatedAt).ThenBy(g => g.Id), 4, cancellationToken);
        var topRatedProducts = await TakeAsync(
            rows.Where(g => g.ReviewCount > 0)
                .OrderByDescending(g => g.AverageRating)
                .ThenByDescending(g => g.ReviewCount)
                .ThenBy(g => g.Id),
            4,
            cancellationToken);

        if (!TryGetCurrentUserId(out var userId))
            return Ok(new ProductInfomationDto(
                categoryCounts, false, null, null, hotProducts, newProducts, topRatedProducts));

        var pointBalance = await db.PointBalances
            .AsNoTracking()
            .Where(balance => balance.UserId == userId)
            .Select(balance => (int?)balance.Balance)
            .SingleOrDefaultAsync(cancellationToken) ?? 0;
        var now = DateTime.UtcNow;
        var coupons = await db.UserCoupons
            .AsNoTracking()
            .Where(coupon => coupon.UserId == userId && coupon.Status == "AVAILABLE")
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
            categoryCounts, true, pointBalance, coupons, hotProducts, newProducts, topRatedProducts));
    }

    /// <summary>商品清單項目的查詢中間形狀，讓各排行榜共用同一份投影再各自排序。</summary>
    private sealed class ProductRow
    {
        public Guid Id { get; init; }
        public Guid? ArtifactId { get; init; }
        public string? ExternalRef { get; init; }
        public string Name { get; init; } = "";
        public string CategoryCode { get; init; } = "";
        public decimal Price { get; init; }
        public int Stock { get; init; }
        public string? PrimaryImagePath { get; init; }
        public DateTime CreatedAt { get; init; }
        public decimal AverageRating { get; init; }
        public int ReviewCount { get; init; }
        public int SellCount { get; init; }
    }

    /// <summary>取排序後前 count 筆並轉為 DTO，圖片網址統一經 CDN 解析。</summary>
    private async Task<IReadOnlyList<ProductListItemDto>> TakeAsync(
        IQueryable<ProductRow> ordered,
        int count,
        CancellationToken cancellationToken)
    {
        var items = await ordered
            .Take(count)
            .Select(g => new ProductListItemDto(
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
                g.SellCount))
            .ToListAsync(cancellationToken);
        return items
            .Select(item => item with { PrimaryImagePath = mediaUrlResolver.Resolve(item.PrimaryImagePath) })
            .ToList();
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
