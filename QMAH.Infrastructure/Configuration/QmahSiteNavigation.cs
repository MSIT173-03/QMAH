using Microsoft.Extensions.Configuration;

namespace QMAH.Infrastructure.Configuration;

public static class QmahSiteNavigation
{
    // 只接受部署設定中的固定站台，不接受使用者傳入的轉址目標。
    public static string GetTarget(IConfiguration configuration, string key)
    {
        var target = configuration[key]?.Trim();
        if (!Uri.TryCreate(target, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(uri.UserInfo))
            throw new InvalidOperationException($"{key} 必須設定為完整的 HTTP 或 HTTPS 站台網址。");

        return uri.AbsoluteUri;
    }
}
