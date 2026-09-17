using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;

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
        Newer,
        Older,
    }
    [HttpGet("products")]
    public async Task<ActionResult<ApiPage<ProductListItemDto>>> GetProducts(
        string? q,
        string? categoryCode,
        Guid? artifactId,
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
        {
            query = query.Where(product =>
                product.Name.Contains(q)
                || (product.ExternalRef != null && product.ExternalRef.Contains(q)));
        }
        if (!string.IsNullOrWhiteSpace(categoryCode))
            query = query.Where(product => product.CategoryCode == categoryCode);
        if (artifactId.HasValue)
            query = query.Where(product => product.ArtifactId == artifactId.Value);
        var query2 = from g in query
                     join r in db.ProductReviews.Where(r => r.Status == "PUBLISHED") on g.Id equals r.ProductId into reviewGroup
                     join o in db.OrderDetails on g.Id equals o.ProductId into orderGroup
                     select new ProductListItemDto
                     (
                         g.Id,
                         g.ArtifactId,
                         g.ExternalRef,
                         g.Name,
                         g.CategoryCode,
                         g.Price,
                         g.Stock,
                         g.PrimaryImagePath,
                         g.CreatedAt,
                         reviewGroup.Any() ? (decimal)reviewGroup.Average(r => r.Rating) : 0m,
                         reviewGroup.Count(),
                         orderGroup.Count()
                     );

        // 排序
        switch (order)
        {
            case OrderType.None:
                query2 = query2
                    .OrderBy(g => g.Name)
                    .ThenBy(g => g.Id);
                break;
            case OrderType.HotSell:
                query2 = query2
                    .OrderBy(g => g.SellCount)
                    .ThenBy(g => g.Id);
                break;
            case OrderType.Newer:
                query2 = query2
                    .OrderBy(g => g.CreatedAt.Ticks)
                    .ThenBy(product => product.Id);
                break;
            case OrderType.Older:
                query2 = query2
                    .OrderByDescending(g => g.CreatedAt.Ticks)
                    .ThenBy(product => product.Id);
                break;
        }

        var result = await ApiPaging.ToPageAsync(query2, page, pageSize, cancellationToken);

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
