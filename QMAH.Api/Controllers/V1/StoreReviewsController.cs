using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

/// <summary>
/// 商城商品的公開評價，以及目前會員自己的評價維護。
/// </summary>
[Route("api/v1/store/products/{productId:guid}/reviews")]
public sealed class StoreReviewsController(QmahDbContext db) : ApiControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<ProductReviewsResponseDto>> GetReviews(
        Guid productId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        if (!await db.Products.AnyAsync(product => product.Id == productId && product.IsActive, cancellationToken))
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        var publishedReviews = db.ProductReviews
            .AsNoTracking()
            .Where(review => review.ProductId == productId && review.Status == "PUBLISHED");
        var reviewCount = await publishedReviews.CountAsync(cancellationToken);
        var averageRating = await publishedReviews
            .Select(review => (decimal?)review.Rating)
            .AverageAsync(cancellationToken) ?? 0m;
        var pageResult = await ApiPaging.ToPageAsync(
            BuildReviewQuery(productId, publishedOnly: true),
            page,
            pageSize,
            cancellationToken);

        // 統計值和分頁資料來自同一個已過濾的公開評價查詢，避免把隱藏或刪除內容算進商品摘要。
        var summary = new ProductReviewSummaryDto(
            Math.Round(averageRating, 1, MidpointRounding.AwayFromZero),
            reviewCount);
        return Ok(new ProductReviewsResponseDto(summary, pageResult));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<ProductReviewDto>> GetMyReview(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();
        if (!await db.Products.AnyAsync(product => product.Id == productId && product.IsActive, cancellationToken))
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        var review = await BuildReviewQuery(productId)
            .Where(item => item.UserId == userId)
            .SingleOrDefaultAsync(cancellationToken);
        return review is null
            ? MissingResource("尚未留下評價", "這個會員還沒有留下這件商品的評價。")
            : Ok(review);
    }

    [Authorize]
    [HttpPut("me")]
    public async Task<ActionResult<ProductReviewDto>> UpsertMyReview(
        Guid productId,
        UpsertProductReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (string.IsNullOrWhiteSpace(request.Content))
            ModelState.AddModelError(nameof(request.Content), "評價內容不可只有空白。");
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();
        if (!await db.Products.AnyAsync(product => product.Id == productId && product.IsActive, cancellationToken))
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");

        var now = DateTime.UtcNow;
        var review = await db.ProductReviews
            .SingleOrDefaultAsync(item => item.ProductId == productId && item.UserId == userId, cancellationToken);
        if (review is null)
        {
            review = new ProductReview
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                UserId = userId,
                CreatedAt = now
            };
            db.ProductReviews.Add(review);
        }

        review.Rating = request.Rating;
        review.Content = request.Content.Trim();
        review.Status = "PUBLISHED";
        review.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(await BuildReviewQuery(productId)
            .SingleAsync(item => item.Id == review.Id, cancellationToken));
    }

    [Authorize]
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMyReview(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();

        var review = await db.ProductReviews
            .SingleOrDefaultAsync(item => item.ProductId == productId && item.UserId == userId, cancellationToken);
        if (review is null)
            return NotFound();

        review.Status = "DELETED";
        review.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private IQueryable<ProductReviewDto> BuildReviewQuery(Guid productId, bool publishedOnly = false)
    {
        var query = db.ProductReviews
            .AsNoTracking()
            .Where(review => review.ProductId == productId && review.Status != "DELETED");

        if (publishedOnly)
            query = query.Where(review => review.Status == "PUBLISHED");

        return query
            .OrderByDescending(review => review.CreatedAt)
            .ThenBy(review => review.Id)
            .Select(review => new ProductReviewDto(
                review.Id,
                review.ProductId,
                review.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == review.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                review.Rating,
                review.Content,
                db.OrderDetails.Any(detail =>
                    detail.ProductId == review.ProductId
                    && detail.Order.UserId == review.UserId
                    && detail.Order.Status != "PENDING_PAYMENT"
                    && detail.Order.Status != "CANCELLED"),
                review.CreatedAt,
                review.UpdatedAt));
    }

    private Task<bool> IsActiveUserAsync(Guid userId, CancellationToken cancellationToken) =>
        db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken);
}
