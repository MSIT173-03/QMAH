using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供管理員處理會員圖鑑解鎖的 API。</summary>
[Authorize(Roles = "Admin")]
[Route("api/v1/admin/catalog")]
public sealed class AdminCatalogController(
    EconomyService economyService,
    QmahDbContext db) : ApiControllerBase
{
    /// <summary>替指定會員強制解鎖一件啟用中的文物；重複呼叫不會建立第二筆解鎖紀錄。</summary>
    [HttpPost("members/{userId:guid}/artifacts/{artifactId:guid}/unlock")]
    public async Task<ActionResult<AdminArtifactUnlockDto>> ForceUnlockArtifact(
        Guid userId,
        Guid artifactId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var adminUserId))
            return Unauthorized();

        var result = await economyService.ForceUnlockArtifactAsync(
            adminUserId,
            userId,
            artifactId,
            cancellationToken);
        if (!result.Succeeded)
            return ToFailure(result);

        var value = result.Value!;
        return Ok(new AdminArtifactUnlockDto(
            value.UserId,
            value.ArtifactId,
            value.Created,
            value.UnlockMethod,
            value.UnlockedAt));
    }

    /// <summary>設定商品單品折扣率；有效售價由後端依 Price 計算。</summary>
    [HttpPut("products/{id:guid}/discount-rate")]
    public async Task<ActionResult<AdminProductDiscountDto>> UpdateProductDiscount(
        Guid id,
        [FromBody] UpdateProductDiscountRequest request,
        CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在。");

        product.DiscountRate = request.DiscountRate!.Value;
        product.SalePrice = null;
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToProductDiscountDto(product));
    }

    /// <summary>以同一折扣率批次更新最多 100 件商品；每件售價均由後端重新計算。</summary>
    [HttpPost("products/discount-rate/batch")]
    public async Task<ActionResult<IReadOnlyList<AdminProductDiscountDto>>> BatchUpdateProductDiscount(
        [FromBody] BatchUpdateProductDiscountRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ProductIds is null || request.DiscountRate is null)
            return ValidationProblem(ModelState);

        var productIds = request.ProductIds!;
        if (productIds.Any(id => id == Guid.Empty)
            || productIds.Distinct().Count() != productIds.Count)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "商品清單無效",
                detail: "ProductIds 不可包含空白識別碼或重複項目。");
        }

        var products = await db.Products
            .Where(item => productIds.Contains(item.Id))
            .ToListAsync(cancellationToken);
        if (products.Count != productIds.Count)
        {
            var existingIds = products.Select(item => item.Id).ToHashSet();
            var missingIds = productIds
                .Where(id => !existingIds.Contains(id))
                .Select(id => id.ToString())
                .ToArray();
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "找不到商品",
                detail: $"下列商品不存在：{string.Join(", ", missingIds)}");
        }

        var discountRate = request.DiscountRate!.Value;
        var updatedAt = DateTime.UtcNow;
        foreach (var product in products)
        {
            product.DiscountRate = discountRate;
            product.SalePrice = null;
            product.UpdatedAt = updatedAt;
        }

        await db.SaveChangesAsync(cancellationToken);

        var productsById = products.ToDictionary(item => item.Id);
        return Ok(productIds
            .Select(id => ToProductDiscountDto(productsById[id]))
            .ToList());
    }

    /// <summary>
    /// 指定單品折扣後售價；數值寫入 SalePrice 並將 DiscountRate 歸零，null 則清除指定售價。
    /// </summary>
    [HttpPut("products/{id:guid}/sale-price")]
    public async Task<ActionResult<AdminProductDiscountDto>> UpdateProductSalePrice(
        Guid id,
        [FromBody] UpdateProductSalePriceRequest request,
        CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在。");

        if (request.SalePrice.HasValue && !IsValidSalePrice(request.SalePrice, product.Price))
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "單品售價無效",
                detail: "SalePrice 必須大於 0 且小於 Price；送 null 可清除指定售價。");
        }

        product.SalePrice = request.SalePrice;
        product.DiscountRate = 0m;
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToProductDiscountDto(product));
    }

    /// <summary>批次指定單品折扣後售價；null 清除指定售價，數值寫入 SalePrice 並將 DiscountRate 歸零。</summary>
    [HttpPost("products/sale-price/batch")]
    public async Task<ActionResult<IReadOnlyList<AdminProductDiscountDto>>> BatchUpdateProductSalePrice(
        [FromBody] BatchUpdateProductSalePriceRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ProductIds is null)
            return ValidationProblem(ModelState);

        var productIds = request.ProductIds;
        if (productIds.Any(id => id == Guid.Empty)
            || productIds.Distinct().Count() != productIds.Count)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "商品清單無效",
                detail: "ProductIds 不可包含空白識別碼或重複項目。");
        }

        var products = await db.Products
            .Where(item => productIds.Contains(item.Id))
            .ToListAsync(cancellationToken);
        if (products.Count != productIds.Count)
        {
            var existingIds = products.Select(item => item.Id).ToHashSet();
            var missingIds = productIds
                .Where(id => !existingIds.Contains(id))
                .Select(id => id.ToString())
                .ToArray();
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "找不到商品",
                detail: $"下列商品不存在：{string.Join(", ", missingIds)}");
        }

        if (request.SalePrice.HasValue)
        {
            var invalidProducts = products
                .Where(product => !IsValidSalePrice(request.SalePrice, product.Price))
                .Select(product => product.Id.ToString())
                .ToArray();
            if (invalidProducts.Length > 0)
            {
                return Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "單品售價無效",
                    detail: $"SalePrice 必須大於 0 且小於各商品 Price；不符合的商品：{string.Join(", ", invalidProducts)}");
            }
        }

        var updatedAt = DateTime.UtcNow;
        foreach (var product in products)
        {
            product.SalePrice = request.SalePrice;
            product.DiscountRate = 0m;
            product.UpdatedAt = updatedAt;
        }

        await db.SaveChangesAsync(cancellationToken);

        var productsById = products.ToDictionary(item => item.Id);
        return Ok(productIds
            .Select(id => ToProductDiscountDto(productsById[id]))
            .ToList());
    }

    private static AdminProductDiscountDto ToProductDiscountDto(Product product) => new(
        product.Id,
        product.Price,
        product.DiscountRate,
        product.EffectivePrice,
        product.SalePrice);

    private static bool IsValidSalePrice(decimal? salePrice, decimal price) =>
        salePrice is > 0m && salePrice < price;

    private ActionResult ToFailure<T>(EconomyResult<T> result) => result.ErrorCode switch
    {
        "NOT_FOUND" => Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "找不到資源",
            detail: result.ErrorMessage),
        "FORBIDDEN" => Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "沒有執行此操作的權限",
            detail: result.ErrorMessage),
        "CONFLICT" => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "目前狀態不允許此操作",
            detail: result.ErrorMessage),
        _ => Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "請求資料無效",
            detail: result.ErrorMessage)
    };
}
