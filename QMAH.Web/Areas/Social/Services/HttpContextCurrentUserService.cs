using System.Security.Claims;

namespace QMAH.Web.Areas.Social.Services;

public sealed class HttpContextCurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public Guid GetCurrentUserId()
    {
        var value = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(value, out var userId)
            ? userId
            : throw new InvalidOperationException("目前請求沒有有效的會員身分。");
    }

    public bool IsAuthenticated() =>
        httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated == true;
}
