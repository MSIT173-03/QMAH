using System.Linq.Expressions;

using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

/// <summary>商品連同查詢時算出的售價；EffectivePrice 與 SalePrice 可直接用於篩選、排序與投影。</summary>
internal sealed class PricedProduct
{
    public Product Product { get; init; } = null!;

    /// <summary>有效售價（Product.EffectivePriceExpression）。</summary>
    public decimal EffectivePrice { get; init; }

    /// <summary>折扣後售價：有效售價低於定價時與 EffectivePrice 相同，沒有折扣時為 null。</summary>
    public decimal? SalePrice { get; init; }
}

/// <summary>商品清單項目的查詢結果；先投影成這個型別才能依 SellCount 等計算欄位排序，再轉成 ProductListItemDto。</summary>
internal sealed class StoreProductListRow
{
    public Guid Id { get; init; }
    public Guid? ArtifactId { get; init; }
    public string? ExternalRef { get; init; }
    public string Name { get; init; } = null!;
    public string CategoryCode { get; init; } = null!;
    public decimal Price { get; init; }
    public decimal DiscountRate { get; init; }
    public decimal EffectivePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public int Stock { get; init; }
    public string? PrimaryImagePath { get; init; }
    public DateTime CreatedAt { get; init; }
    public decimal AverageRating { get; init; }
    public int ReviewCount { get; init; }
    public int SellCount { get; init; }
}

/// <summary>
/// StoreCatalogController 各端點共用的商品查詢片段：售價只有 Product.EffectivePriceExpression 一份定義，
/// 清單項目的欄位（評價摘要、販售數量）也只在這裡投影一次。
/// </summary>
internal static class StoreProductQueries
{
    private static readonly Expression<Func<Product, PricedProduct>> ToPricedProduct = BuildToPricedProduct();

    /// <summary>為每件商品加上有效售價與折扣後售價，後續的篩選、排序與投影都引用這兩個欄位。</summary>
    public static IQueryable<PricedProduct> WithPricing(this IQueryable<Product> products) =>
        products.Select(ToPricedProduct);

    /// <summary>投影成清單項目：評價摘要只計已發布（PUBLISHED）的評價，販售數量只計已完成（COMPLETED）的訂單。</summary>
    public static IQueryable<StoreProductListRow> SelectListRows(this IQueryable<PricedProduct> products) =>
        products.Select(item => new StoreProductListRow
        {
            Id = item.Product.Id,
            ArtifactId = item.Product.ArtifactId,
            ExternalRef = item.Product.ExternalRef,
            Name = item.Product.Name,
            CategoryCode = item.Product.CategoryCode,
            Price = item.Product.Price,
            DiscountRate = item.Product.DiscountRate,
            EffectivePrice = item.EffectivePrice,
            SalePrice = item.SalePrice,
            Stock = item.Product.Stock,
            PrimaryImagePath = item.Product.PrimaryImagePath
                ?? (item.Product.Artifact == null ? null : item.Product.Artifact.PrimaryImagePath),
            CreatedAt = item.Product.CreatedAt,
            AverageRating = item.Product.ProductReviews
                .Where(review => review.Status == "PUBLISHED")
                .Average(review => (decimal?)review.Rating) ?? 0m,
            ReviewCount = item.Product.ProductReviews.Count(review => review.Status == "PUBLISHED"),
            SellCount = item.Product.OrderDetails
                .Where(detail => detail.Order.Status == "COMPLETED")
                .Sum(detail => detail.Quantity)
        });

    public static IQueryable<ProductListItemDto> ToListItems(this IQueryable<StoreProductListRow> rows) =>
        rows.Select(row => new ProductListItemDto(
            row.Id,
            row.ArtifactId,
            row.ExternalRef,
            row.Name,
            row.CategoryCode,
            row.Price,
            row.DiscountRate,
            row.EffectivePrice,
            row.SalePrice,
            row.Stock,
            row.PrimaryImagePath,
            row.CreatedAt,
            row.AverageRating,
            row.ReviewCount,
            row.SellCount));

    /// <summary>
    /// 組出 product => new PricedProduct { Product, EffectivePrice, SalePrice }。
    /// 直接沿用 Product.EffectivePriceExpression 的參數與內容，售價規則才不會在這裡再寫一次。
    /// </summary>
    private static Expression<Func<Product, PricedProduct>> BuildToPricedProduct()
    {
        var product = Product.EffectivePriceExpression.Parameters[0];
        var effectivePrice = Product.EffectivePriceExpression.Body;
        var salePrice = Expression.Condition(
            Expression.LessThan(effectivePrice, Expression.Property(product, nameof(Product.Price))),
            Expression.Convert(effectivePrice, typeof(decimal?)),
            Expression.Constant(null, typeof(decimal?)));

        return Expression.Lambda<Func<Product, PricedProduct>>(
            Expression.MemberInit(
                Expression.New(typeof(PricedProduct)),
                Expression.Bind(typeof(PricedProduct).GetProperty(nameof(PricedProduct.Product))!, product),
                Expression.Bind(typeof(PricedProduct).GetProperty(nameof(PricedProduct.EffectivePrice))!, effectivePrice),
                Expression.Bind(typeof(PricedProduct).GetProperty(nameof(PricedProduct.SalePrice))!, salePrice)),
            product);
    }
}
