using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace QMAH.Infrastructure.Security;

public static class QmahSharedAuthentication
{
    public const string CookieName = ".QMAH.Auth";
    public const string DataProtectionApplicationName = "QMAH";

    // Angular 開發代理是 HTTP；兩個主機寫入同一張票證時必須使用相同的 Secure 規則。
    // 正式環境仍只允許 HTTPS，且不設定跨網域 Cookie。
    public static CookieSecurePolicy GetSecurePolicy(IHostEnvironment environment) =>
        environment.IsDevelopment() ? CookieSecurePolicy.None : CookieSecurePolicy.Always;
}
