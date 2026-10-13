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
        // 每次查詢隨機排序（SQL Server NEWID()）；新值加在最後，前端以數字傳遞的既有排序值不受影響。
        Random,
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
        // 中原、日本兩組年代各自照年代先後排序，但先分組再排序：兩地年代區間本來就會重疊
        // （例如日本江戶時代早於清），單純依 StartYear 排序會讓兩地年代交錯出現。
        var eras = await db.EraBuckets
            .AsNoTracking()
            .OrderBy(era => era.Code.StartsWith("JAPAN_") ? 1 : 0)
            .ThenBy(era => era.StartYear)
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

        // 售價相關的篩選與排序都引用 WithPricing 算出的欄位，售價規則只有 Product.EffectivePriceExpression 一份。
        var priced = query.WithPricing();

        // integration: 限時特賣以後端算出的折扣後售價判斷（有效單品售價或大於 0 的折扣率），不以前端標籤推測。
        if (dealOnly == true)
            priced = priced.Where(item => item.SalePrice != null);
        if (minPrice is not null and > 0)
            priced = priced.Where(item => item.EffectivePrice >= minPrice);
        if (maxPrice is not null and > 0)
            priced = priced.Where(item => item.EffectivePrice < maxPrice);

        var rows = priced.SelectListRows();
        var sorted = order switch
        {
            OrderType.HotSell => rows
                .OrderByDescending(row => row.SellCount)
                .ThenBy(row => row.Id),
            OrderType.Older => rows
                .OrderBy(row => row.CreatedAt)
                .ThenBy(row => row.Id),
            OrderType.Newer => rows
                .OrderByDescending(row => row.CreatedAt)
                .ThenBy(row => row.Id),
            OrderType.CheaperFirst => rows
                .OrderBy(row => row.EffectivePrice)
                .ThenBy(row => row.Id),
            OrderType.PricierFirst => rows
                .OrderByDescending(row => row.EffectivePrice)
                .ThenBy(row => row.Id),
            OrderType.Random => rows
                .OrderBy(row => Guid.NewGuid()),
            _ => rows.OrderBy(row => row.Id),
        };

        var result = await ApiPaging.ToPageAsync(sorted.ToListItems(), page, pageSize, cancellationToken);

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
            .Where(product => product.Id == id && product.IsActive)
            .WithPricing()
            .Select(item => new ProductDetailsDto(
                item.Product.Id,
                item.Product.ArtifactId,
                item.Product.Artifact == null ? null : item.Product.Artifact.ArtifactRef,
                item.Product.Artifact == null ? null : item.Product.Artifact.Name,
                item.Product.ExternalRef,
                item.Product.Name,
                item.Product.CategoryCode,
                item.Product.Description,
                item.Product.SizeText,
                // 同時提供關聯文物原始尺寸；商品尺寸不再承擔兩種語意。
                item.Product.Artifact == null ? null : item.Product.Artifact.SizeText,
                item.Product.Price,
                item.Product.DiscountRate,
                item.EffectivePrice,
                item.SalePrice,
                item.Product.Stock,
                item.Product.PrimaryImagePath
                    ?? (item.Product.Artifact == null ? null : item.Product.Artifact.PrimaryImagePath),
                item.Product.SourceUrl,
                item.Product.IsActive,
                item.Product.ProductReviews
                    .Where(review => review.Status == "PUBLISHED")
                    .Select(review => (decimal?)review.Rating)
                    .Average() ?? 0m,
                item.Product.ProductReviews.Count(review => review.Status == "PUBLISHED")))
            .SingleOrDefaultAsync(cancellationToken);

        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        // 原本直接回傳 PrimaryImagePath；棄用原因：資料庫只保存邏輯路徑，公開來源由部署設定決定。
        return Ok(product with
        {
            PrimaryImagePath = mediaUrlResolver.Resolve(product.PrimaryImagePath)
        });
    }

    /// <summary>
    /// 同類推薦：找出買過這件商品的所有帳號，把這些帳號買過的商品依合計購買數量由多到少排序，取前 limit + 1 項；
    /// 其中若有目前這件商品就排除它，否則排除最後一項，使結果剛好是 limit 項（符合條件的商品不足時則較少）。
    /// 只計入訂單狀態不是待付款（PENDING_PAYMENT）或已取消（CANCELLED）的訂單，與評價的 IsVerifiedPurchase 判斷一致，
    /// 也只列出上架中的商品。
    /// </summary>
    [HttpGet("products/{id:guid}/related")]
    public async Task<ActionResult<IReadOnlyList<ProductListItemDto>>> GetRelatedProducts(
        Guid id,
        int limit = 5,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 20);

        var exists = await db.Products
            .AsNoTracking()
            .AnyAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (!exists)
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        var buyerIds = db.OrderDetails
            .Where(detail => detail.ProductId == id
                && detail.Order.Status != "PENDING_PAYMENT"
                && detail.Order.Status != "CANCELLED")
            .Select(detail => detail.Order.UserId)
            .Distinct();

        var ranking = await db.OrderDetails
            .AsNoTracking()
            .Where(detail => detail.Order.Status != "PENDING_PAYMENT"
                && detail.Order.Status != "CANCELLED"
                && detail.Product.IsActive
                && buyerIds.Contains(detail.Order.UserId))
            .GroupBy(detail => detail.ProductId)
            .Select(group => new { ProductId = group.Key, Quantity = group.Sum(detail => detail.Quantity) })
            .OrderByDescending(row => row.Quantity)
            .ThenBy(row => row.ProductId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var productIds = ranking.Select(row => row.ProductId).ToList();
        if (!productIds.Remove(id) && productIds.Count > limit)
            productIds.RemoveAt(productIds.Count - 1);
        if (productIds.Count == 0)
            return Ok(Array.Empty<ProductListItemDto>());

        // 依合計購買數量的順序回傳。
        return Ok(await LoadListItemsAsync(productIds, cancellationToken));
    }

    /// <summary>
    /// 為你推薦：依目前會員買過的商品在各文物種類（CategoryCode）的數量比例分配 limit 個名額，
    /// 每個種類隨機挑出對應件數的上架商品；種類內商品不足時，不足的名額以其他隨機商品補滿。
    /// 未登入或沒有購買紀錄時整份都是隨機商品。「買過」與 GetPurchasedProductIds 相同：
    /// 訂單狀態不是待付款（PENDING_PAYMENT）或已取消（CANCELLED）。
    /// </summary>
    [HttpGet("products/recommended")]
    public async Task<ActionResult<IReadOnlyList<ProductListItemDto>>> GetRecommendedProducts(
        int limit = 20,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 50);

        var purchased = new List<(string CategoryCode, int Quantity)>();
        if (TryGetCurrentUserId(out var userId))
        {
            var rows = await db.OrderDetails
                .AsNoTracking()
                .Where(detail => detail.Order.UserId == userId
                    && detail.Order.Status != "PENDING_PAYMENT"
                    && detail.Order.Status != "CANCELLED")
                .GroupBy(detail => detail.Product.CategoryCode)
                .Select(group => new { CategoryCode = group.Key, Quantity = group.Sum(detail => detail.Quantity) })
                .ToListAsync(cancellationToken);
            purchased = rows.Select(row => (row.CategoryCode, row.Quantity)).ToList();
        }

        var productIds = new List<Guid>();
        foreach (var (categoryCode, count) in AllocateByProportion(purchased, limit))
        {
            productIds.AddRange(await db.Products
                .AsNoTracking()
                .Where(product => product.IsActive && product.CategoryCode == categoryCode)
                .OrderBy(product => Guid.NewGuid())
                .Select(product => product.Id)
                .Take(count)
                .ToListAsync(cancellationToken));
        }

        // 沒有購買紀錄，或某些種類的上架商品不夠分配的名額：以其他隨機商品補滿。
        if (productIds.Count < limit)
        {
            productIds.AddRange(await db.Products
                .AsNoTracking()
                .Where(product => product.IsActive && !productIds.Contains(product.Id))
                .OrderBy(product => Guid.NewGuid())
                .Select(product => product.Id)
                .Take(limit - productIds.Count)
                .ToListAsync(cancellationToken));
        }

        // 打散順序，避免同一種類的商品連在一起。
        var shuffled = productIds.ToArray();
        Random.Shared.Shuffle(shuffled);
        return Ok(await LoadListItemsAsync(shuffled, cancellationToken));
    }

    /// <summary>
    /// 依購買數量比例把 limit 個名額分給各種類（最大餘數法）：先各取比例的整數部分，
    /// 剩下的名額依餘數由大到小各補一個，總和剛好是 limit。沒有購買紀錄時不分配。
    /// </summary>
    private static List<(string CategoryCode, int Count)> AllocateByProportion(
        List<(string CategoryCode, int Quantity)> purchased,
        int limit)
    {
        var total = purchased.Sum(item => (long)item.Quantity);
        if (total <= 0)
            return [];

        var shares = purchased
            .Select(item => (
                item.CategoryCode,
                Count: (int)(item.Quantity * (long)limit / total),
                Remainder: item.Quantity * (long)limit % total))
            .ToList();
        var leftover = limit - shares.Sum(share => share.Count);
        return shares
            .OrderByDescending(share => share.Remainder)
            .ThenBy(share => share.CategoryCode)
            .Select((share, index) => (share.CategoryCode, Count: share.Count + (index < leftover ? 1 : 0)))
            .Where(share => share.Count > 0)
            .ToList();
    }

    /// <summary>
    /// 依指定順序取回商品清單項目，欄位與 GetProducts 相同（有效售價、評價摘要、已完成訂單的販售數量），
    /// 並統一轉換公開圖片網址；已下架或不存在的編號會略過。
    /// </summary>
    private async Task<List<ProductListItemDto>> LoadListItemsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken)
    {
        var products = await db.Products
            .AsNoTracking()
            .Where(product => productIds.Contains(product.Id))
            .WithPricing()
            .SelectListRows()
            .ToListItems()
            .ToListAsync(cancellationToken);

        return productIds
            .Select(productId => products.FirstOrDefault(product => product.Id == productId))
            .OfType<ProductListItemDto>()
            .Select(product => product with { PrimaryImagePath = mediaUrlResolver.Resolve(product.PrimaryImagePath) })
            .ToList();
    }
}
