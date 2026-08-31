using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/me")]
public sealed class MeController(
    QmahDbContext db,
    UserManager<ApplicationUser> userManager) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<MeDto>> GetMe(CancellationToken cancellationToken = default)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();
        var roles = await userManager.GetRolesAsync(user);
        var profile = await db.UserProfiles
            .AsNoTracking()
            .Where(profile => profile.UserId == user.Id)
            .Select(profile => new
            {
                profile.Nickname,
                profile.Bio,
                profile.Visibility,
                profile.AvatarPath
            })
            .SingleOrDefaultAsync(cancellationToken);
        var pointBalance = await db.PointBalances
            .AsNoTracking()
            .Where(balance => balance.UserId == user.Id)
            .Select(balance => (int?)balance.Balance)
            .SingleOrDefaultAsync(cancellationToken) ?? 0;

        return Ok(new MeDto(
            user.Id,
            user.Email ?? "",
            profile?.Nickname,
            user.Status,
            pointBalance,
            roles.ToList(),
            user.CreatedAt,
            profile?.Bio,
            profile?.Visibility ?? "PRIVATE",
            profile?.AvatarPath));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<MeDto>> UpdateProfile(
        UpdateProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (!await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken))
            return Forbid();

        var nickname = request.Nickname.Trim();
        if (nickname.Length == 0)
        {
            ModelState.AddModelError(nameof(request.Nickname), "暱稱不可為空白。");
            return ValidationProblem(ModelState);
        }

        var profile = await db.UserProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        if (profile is null)
        {
            profile = new UserProfile
            {
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                Visibility = request.Visibility.Trim().ToUpperInvariant()
            };
            db.UserProfiles.Add(profile);
        }

        profile.Nickname = nickname;
        profile.Bio = NormalizeText(request.Bio);
        profile.Visibility = request.Visibility.Trim().ToUpperInvariant();
        profile.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return await GetMe(cancellationToken);
    }

    [HttpGet("orders")]
    public async Task<ActionResult<ApiPage<OrderDto>>> GetOrders(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var query = db.StoreOrders
            .AsNoTracking()
            .Where(order => order.UserId == userId);
        (page, pageSize) = ApiPaging.Normalize(page, pageSize);
        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        page = totalPages == 0 ? 1 : Math.Min(page, totalPages);
        var orders = await query
            .OrderByDescending(order => order.CreatedAt)
            .ThenBy(order => order.Id)
            .Include(order => order.OrderDetails)
            .Include(order => order.Payment)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return Ok(new ApiPage<OrderDto>(
            orders.Select(ToOrderDto).ToList(),
            page,
            pageSize,
            totalCount,
            totalPages));
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<ActionResult<OrderDto>> GetOrder(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var order = await db.StoreOrders
            .AsNoTracking()
            .Where(item => item.Id == id && item.UserId == userId)
            .Include(item => item.OrderDetails)
            .Include(item => item.Payment)
            .SingleOrDefaultAsync(cancellationToken);
        return order is null
            ? MissingResource("找不到訂單", "這筆訂單不存在或不屬於目前帳號。")
            : Ok(ToOrderDto(order));
    }

    [HttpGet("coupons")]
    public async Task<ActionResult<IReadOnlyList<CouponDto>>> GetCoupons(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var now = DateTime.UtcNow;
        var coupons = await db.UserCoupons
            .AsNoTracking()
            .Where(coupon => coupon.UserId == userId)
            .OrderByDescending(coupon => coupon.IssuedAt)
            .Select(coupon => new CouponDto(
                coupon.Id,
                coupon.CouponDefinition.Code,
                coupon.CouponDefinition.Name,
                coupon.CouponDefinition.DiscountType,
                coupon.CouponDefinition.DiscountValue,
                coupon.CouponDefinition.MinimumAmount,
                coupon.CouponDefinition.StartAt,
                coupon.CouponDefinition.EndAt,
                coupon.Status == "AVAILABLE"
                    && coupon.CouponDefinition.IsActive
                    && coupon.CouponDefinition.StartAt <= now
                    && coupon.CouponDefinition.EndAt >= now
                    ? "AVAILABLE"
                    : coupon.Status,
                coupon.IssuedAt))
            .ToListAsync(cancellationToken);
        return Ok(coupons);
    }

    [HttpGet("posts")]
    public async Task<ActionResult<ApiPage<SocialPostListItemDto>>> GetPosts(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var query = db.SocialPosts
            .AsNoTracking()
            .Where(post => post.UserId == userId)
            .OrderByDescending(post => post.CreatedAt)
            .Select(post => new SocialPostListItemDto(
                post.Id,
                post.BoardCode,
                post.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == post.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                post.ArtifactId,
                post.EventId,
                post.PostType,
                post.PublisherType,
                post.Title,
                post.Content.Length > 180 ? post.Content.Substring(0, 180) : post.Content,
                post.SocialComments.Count(comment => comment.Status == "PUBLISHED"),
                post.MediaAssets.Count(media => media.Status == "ACTIVE"),
                post.LocationName,
                post.Latitude,
                post.Longitude,
                post.CreatedAt,
                post.UpdatedAt));
        return Ok(await ApiPaging.ToPageAsync(query, page, pageSize, cancellationToken));
    }

    [HttpGet("achievements")]
    public async Task<ActionResult<IReadOnlyList<UserAchievementDto>>> GetAchievements(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var achievements = await db.UserAchievements
            .AsNoTracking()
            .Where(item => item.UserId == userId && item.Achievement.Status == "ACTIVE")
            .OrderByDescending(item => item.AchievedAt)
            .Select(item => new UserAchievementDto(
                item.Id,
                item.AchievementId,
                item.Achievement.Code,
                item.Achievement.Name,
                item.Achievement.Title,
                item.Achievement.Description,
                item.Achievement.IconPath,
                item.Achievement.ConditionType,
                item.Achievement.ThresholdValue,
                item.AchievedAt,
                item.IsDisplayed,
                item.DisplayedAt))
            .ToListAsync(cancellationToken);
        return Ok(achievements);
    }

    [HttpGet("cart")]
    public async Task<ActionResult<IReadOnlyList<CartItemDto>>> GetCart(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        return Ok(await GetCartItemsAsync(userId, cancellationToken));
    }

    [HttpPost("cart")]
    public async Task<ActionResult<CartItemDto>> AddCartItem(
        UpsertCartItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        return await UpsertCartItemAsync(userId, request.ProductId, request.Quantity, cancellationToken);
    }

    [HttpPut("cart/{productId:guid}")]
    public async Task<ActionResult<CartItemDto>> UpdateCartItem(
        Guid productId,
        UpsertCartItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (request.ProductId != Guid.Empty && request.ProductId != productId)
            ModelState.AddModelError(nameof(request.ProductId), "商品識別不一致，請重新整理購物車後再試。");
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        return await UpsertCartItemAsync(userId, productId, request.Quantity, cancellationToken);
    }

    [HttpDelete("cart/{productId:guid}")]
    public async Task<IActionResult> RemoveCartItem(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var item = await db.CartItems
            .FirstOrDefaultAsync(cartItem => cartItem.UserId == userId && cartItem.ProductId == productId, cancellationToken);
        if (item is null)
            return NoContent();

        db.CartItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("addresses")]
    public async Task<ActionResult<IReadOnlyList<UserAddressDto>>> GetAddresses(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var addressRows = await db.UserAddresses
            .AsNoTracking()
            .Where(address => address.UserId == userId)
            .OrderByDescending(address => address.IsDefault)
            .ThenBy(address => address.AddressLabel)
            .ThenBy(address => address.Id)
            .Select(address => new
            {
                address.Id,
                address.AddressLabel,
                address.RecipientName,
                address.RecipientPhone,
                address.PostalCode,
                address.City,
                address.District,
                address.AddressLine,
                address.Latitude,
                address.Longitude,
                address.IsDefault,
                address.CreatedAt,
                address.UpdatedAt
            })
            .ToListAsync(cancellationToken);
        return Ok(addressRows.Select(address => new UserAddressDto(
            address.Id,
            address.AddressLabel,
            address.RecipientName,
            address.RecipientPhone,
            address.PostalCode,
            address.City,
            address.District,
            address.AddressLine,
            address.Latitude,
            address.Longitude,
            address.IsDefault,
            address.CreatedAt,
            address.UpdatedAt)).ToList());
    }

    [HttpPost("addresses")]
    public async Task<ActionResult<UserAddressDto>> CreateAddress(
        UpsertUserAddressRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        ValidateAddressCoordinates(request);
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var label = request.AddressLabel.Trim();
        if (await db.UserAddresses.AnyAsync(
                address => address.UserId == userId && address.AddressLabel == label,
                cancellationToken))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "地址標籤已存在",
                detail: "目前帳號已有相同的地址標籤，請改用其他名稱。");
        }

        var hasAddress = await db.UserAddresses.AnyAsync(address => address.UserId == userId, cancellationToken);
        var now = DateTime.UtcNow;
        var address = new UserAddress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            AddressLabel = label,
            RecipientName = request.RecipientName.Trim(),
            RecipientPhone = request.RecipientPhone.Trim(),
            PostalCode = NormalizeText(request.PostalCode),
            City = NormalizeText(request.City),
            District = NormalizeText(request.District),
            AddressLine = request.AddressLine.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsDefault = request.IsDefault || !hasAddress,
            CreatedAt = now,
            UpdatedAt = now
        };
        if (address.IsDefault)
            await ClearDefaultAddressesAsync(userId, null, cancellationToken);

        db.UserAddresses.Add(address);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetAddresses), null, ToAddressDto(address));
    }

    [HttpPut("addresses/{id:guid}")]
    public async Task<ActionResult<UserAddressDto>> UpdateAddress(
        Guid id,
        UpsertUserAddressRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        ValidateAddressCoordinates(request);
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var address = await db.UserAddresses
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (address is null)
            return MissingResource("找不到地址", "這筆地址不存在或不屬於目前帳號。");

        var label = request.AddressLabel.Trim();
        if (await db.UserAddresses.AnyAsync(
                item => item.UserId == userId && item.Id != id && item.AddressLabel == label,
                cancellationToken))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "地址標籤已存在",
                detail: "目前帳號已有相同的地址標籤，請改用其他名稱。");
        }

        address.AddressLabel = label;
        address.RecipientName = request.RecipientName.Trim();
        address.RecipientPhone = request.RecipientPhone.Trim();
        address.PostalCode = NormalizeText(request.PostalCode);
        address.City = NormalizeText(request.City);
        address.District = NormalizeText(request.District);
        address.AddressLine = request.AddressLine.Trim();
        address.Latitude = request.Latitude;
        address.Longitude = request.Longitude;
        address.UpdatedAt = DateTime.UtcNow;
        if (request.IsDefault)
        {
            await ClearDefaultAddressesAsync(userId, address.Id, cancellationToken);
            address.IsDefault = true;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToAddressDto(address));
    }

    [HttpDelete("addresses/{id:guid}")]
    public async Task<IActionResult> DeleteAddress(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var address = await db.UserAddresses
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (address is null)
            return MissingResource("找不到地址", "這筆地址不存在或不屬於目前帳號。");

        var wasDefault = address.IsDefault;
        address.IsDefault = false;
        db.UserAddresses.Remove(address);
        if (wasDefault)
        {
            var replacement = await db.UserAddresses
                .Where(item => item.UserId == userId && item.Id != id)
                .OrderBy(item => item.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            if (replacement is not null)
            {
                replacement.IsDefault = true;
                replacement.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("addresses/{id:guid}/default")]
    public async Task<ActionResult<UserAddressDto>> SetDefaultAddress(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var address = await db.UserAddresses
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (address is null)
            return MissingResource("找不到地址", "這筆地址不存在或不屬於目前帳號。");

        await ClearDefaultAddressesAsync(userId, address.Id, cancellationToken);
        address.IsDefault = true;
        address.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToAddressDto(address));
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<ApiPage<NotificationDto>>> GetNotifications(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var query = db.UserNotifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId)
            .OrderByDescending(notification => notification.CreatedAt)
            .Select(notification => new NotificationDto(
                notification.Id,
                notification.Title,
                notification.Content,
                notification.TargetUrl,
                notification.IsRead,
                notification.CreatedAt,
                notification.ReadAt));
        return Ok(await ApiPaging.ToPageAsync(query, page, pageSize, cancellationToken));
    }

    [HttpPost("notifications/{id:guid}/read")]
    public async Task<IActionResult> MarkNotificationRead(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var notification = await db.UserNotifications
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        if (notification is null)
            return NotFound();
        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    private static OrderDto ToOrderDto(StoreOrder order) => new(
        order.Id,
        order.OrderNo,
        order.Status,
        order.Subtotal,
        order.DiscountAmount,
        order.PointsUsed,
        order.TotalAmount,
        order.RecipientName,
        order.RecipientPhone,
        order.ShippingPostalCode,
        order.ShippingCity,
        order.ShippingDistrict,
        order.ShippingAddressLine,
        order.Payment?.Status,
        order.CreatedAt,
        order.PaidAt,
        order.CancelledAt,
        order.OrderDetails
            .OrderBy(detail => detail.Id)
            .Select(detail => new OrderLineDto(
                detail.ProductId,
                detail.ProductNameSnapshot,
                detail.UnitPrice,
                detail.Quantity,
                detail.LineTotal))
            .ToList());

    private static UserAddressDto ToAddressDto(UserAddress address) => new(
        address.Id,
        address.AddressLabel,
        address.RecipientName,
        address.RecipientPhone,
        address.PostalCode,
        address.City,
        address.District,
        address.AddressLine,
        address.Latitude,
        address.Longitude,
        address.IsDefault,
        address.CreatedAt,
        address.UpdatedAt);

    private async Task<List<CartItemDto>> GetCartItemsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await db.CartItems
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.AddedAt)
            .Select(item => new CartItemDto(
                item.Id,
                item.ProductId,
                item.Product.Name,
                item.Product.PrimaryImagePath,
                item.Product.Price,
                item.Quantity,
                item.Product.Stock,
                item.Product.Price * item.Quantity,
                item.AddedAt))
            .ToListAsync(cancellationToken);
    }

    private async Task<ActionResult<CartItemDto>> UpsertCartItemAsync(
        Guid userId,
        Guid productId,
        int quantity,
        CancellationToken cancellationToken)
    {
        var product = await db.Products
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == productId && item.IsActive, cancellationToken);
        if (product is null)
            return MissingResource("找不到商品", "這件商品不存在或目前未上架。");
        if (quantity > product.Stock)
            return InvalidWorkflow("庫存不足", $"目前最多只能加入 {product.Stock} 件。");

        var cartItem = await db.CartItems
            .FirstOrDefaultAsync(item => item.UserId == userId && item.ProductId == productId, cancellationToken);
        var now = DateTime.UtcNow;
        if (cartItem is null)
        {
            cartItem = new CartItem
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ProductId = productId,
                Quantity = quantity,
                AddedAt = now
            };
            db.CartItems.Add(cartItem);
        }
        else
        {
            cartItem.Quantity = quantity;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new CartItemDto(
            cartItem.Id,
            cartItem.ProductId,
            product.Name,
            product.PrimaryImagePath,
            product.Price,
            cartItem.Quantity,
            product.Stock,
            product.Price * cartItem.Quantity,
            cartItem.AddedAt));
    }

    private void ValidateAddressCoordinates(UpsertUserAddressRequest request)
    {
        if (request.Latitude.HasValue != request.Longitude.HasValue)
            ModelState.AddModelError(nameof(request.Latitude), "地址座標必須同時提供緯度與經度；也可以兩者都留白。");
    }

    private async Task ClearDefaultAddressesAsync(
        Guid userId,
        Guid? exceptAddressId,
        CancellationToken cancellationToken)
    {
        var defaults = await db.UserAddresses
            .Where(address => address.UserId == userId
                && address.IsDefault
                && (!exceptAddressId.HasValue || address.Id != exceptAddressId.Value))
            .ToListAsync(cancellationToken);
        foreach (var address in defaults)
        {
            address.IsDefault = false;
            address.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static string? NormalizeText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
