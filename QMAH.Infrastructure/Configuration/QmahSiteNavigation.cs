using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace QMAH.Infrastructure.Configuration;

public static class QmahSiteNavigation
{
    // 只接受部署設定中的固定站台，不接受使用者傳入的轉址目標。
    public static string GetTarget(
        IConfiguration configuration,
        string key,
        bool isDevelopment = false,
        string? requestHost = null)
    {
        var target = configuration[key]?.Trim();
        if (!Uri.TryCreate(target, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(uri.UserInfo))
            throw new InvalidOperationException($"{key} 必須設定為完整的 HTTP 或 HTTPS 站台網址。");

        // 只在本機開發保留目前的 loopback 主機名稱，避免 localhost 與 127.0.0.1
        // 切換後變成不同的 Cookie 站台；部署網域與自訂站台設定不改寫。
        if (isDevelopment && IsLocalHost(uri.Host) && IsLocalHost(requestHost))
            return new UriBuilder(uri) { Host = requestHost! }.Uri.AbsoluteUri;

        return uri.AbsoluteUri;
    }

    private static bool IsLocalHost(string? host) =>
        host is "localhost" or "127.0.0.1" or "::1" or "[::1]";

    public static string GetRequestHost(HttpRequest request, bool isDevelopment)
    {
        // Angular 的 changeOrigin 會改寫 Host，但保留瀏覽器的 Referer。
        // 只接受開發環境的 loopback 來源；正式環境不從此標頭推導轉址。
        if (isDevelopment
            && Uri.TryCreate(request.Headers.Referer.ToString(), UriKind.Absolute, out var source)
            && source.Scheme is "http" or "https"
            && IsLocalHost(source.Host))
            return source.Host;

        return request.Host.Host;
    }
}
