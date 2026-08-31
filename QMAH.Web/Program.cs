using System.IO.Compression;
using System.Threading.RateLimiting;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.ResponseCompression;

using QMAH.Web.Areas.Social;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Infrastructure.Development;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Infrastructure.Audit;
using QMAH.Infrastructure.CatalogImport;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Security;

var builder = WebApplication.CreateBuilder(args);
var cookieSecurePolicy = builder.Environment.IsDevelopment()
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

// 本機設定檔只存開發環境的連線字串與展示選項，不進版本控制

builder.Services.AddControllersWithViews(options =>
{
    // 所有非 GET MVC Action 預設驗證 Anti-forgery token。
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    options.Filters.AddService<AdminAuditLogFilter>();
});
// CSS、JavaScript、HTML、JSON 與 SVG 分檔管理，回應時用快速壓縮減少傳輸量
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes
        .Concat(["image/svg+xml"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
builder.Services.AddAntiforgery(options =>
{
    // Web 的表單使用 hidden token；內部 cookie 不需要暴露給 JavaScript。
    // 與 API 分開命名，避免雙啟動時互相覆蓋。
    options.Cookie.Name = ".QMAH.Web.Antiforgery";
    options.Cookie.HttpOnly = true;
    // 開發環境的 http 啟動設定也能正常登入；非開發環境一律只允許 HTTPS Cookie。
    options.Cookie.SecurePolicy = cookieSecurePolicy;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.HeaderName = "X-XSRF-TOKEN";
});

// 每個 request 各自取得 DbContext，避免應用程式啟動時先連線資料庫
builder.Services.AddDbContext<QmahDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("QmahDatabase")
        ?? throw new InvalidOperationException(
            "Connection string 'QmahDatabase' was not found."));
});
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Stores.MaxLengthForKeys = 128;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<QmahDbContext>()
    .AddDefaultTokenProviders();

// 後台沿用 Identity 的帳號、角色、鎖定與密碼驗證，前台之後可共用會員資料
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
{
    // 會員被後台停用後，既有登入 cookie 也要在下一次 request 失效。
    options.ValidationInterval = TimeSpan.Zero;
});

// 權限政策集中註冊，畫面只宣告需要的政策，不自行判斷角色字串
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

// 外部圖鑑資料只在匯入時呼叫，設定逾時與 User-Agent 避免 request 長時間卡住
builder.Services.AddHttpClient<NpmOpenDataClient>(client =>
{
    client.BaseAddress = new Uri(
        "https://odapi.npm.gov.tw/data/open/api/v1/digitalCollection/",
        UriKind.Absolute);
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("QMAH-CatalogImport/1.0");
});
builder.Services.AddScoped<ICurrentUserService, HttpContextCurrentUserService>();
builder.Services.AddSocialAuthorizationPolicies();
builder.Services.AddSingleton<AdminNavigationService>();
builder.Services.AddScoped<AdminAuditLogFilter>();
builder.Services.AddScoped<CatalogImportService>();
builder.Services.AddScoped<IPasswordHasher<GameRoom>, PasswordHasher<GameRoom>>();

// 登入端點使用固定視窗限流，避免錯誤密碼嘗試拖慢其他後台頁面
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 12,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services.ConfigureApplicationCookie(options =>
{
    // Identity 登入狀態由受 Data Protection 保護的 HttpOnly Cookie 保存。
    // 固定且獨立的名稱避免 Web、API 與舊版登入票證互相混用
    options.Cookie.Name = ".QMAH.Web.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = cookieSecurePolicy;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/User/Account/Logout";
    options.AccessDeniedPath = "/User/Account/AccessDenied";
    options.Events.OnRedirectToLogin = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }

        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }

        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

// 開發時常在同一個 localhost 切換版本，回應時清除舊票證避免 Cookie 越積越多
builder.WebHost.ConfigureKestrel(options =>
{
    // 保留有限標頭上限，讓清理中介軟體有機會處理舊 Cookie
    options.Limits.MaxRequestHeadersTotalSize = 64 * 1024;
});

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    await DevelopmentAdminSeeder.ResetDevelopmentPasswordsAsync(
        app.Services,
        builder.Configuration);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// 使用者離開頁面造成的 request cancellation 屬正常中止，不當成伺服器錯誤。
app.UseResponseCompression();
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (OperationCanceledException)
        when (context.RequestAborted.IsCancellationRequested)
    {
        // 瀏覽器已中止 request，不需要再產生錯誤頁或延長查詢 timeout。
    }
});

// 順序先建立路由，再限流與清理 Cookie，最後才驗證登入身分
app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();
app.UseQmahCookieRecovery(
    ".QMAH.Web.Auth",
    ".QMAH.Web.Antiforgery",
    ".QMAH.Api.Auth",
    ".QMAH.Api.Antiforgery");

app.UseAuthentication();
app.UseAuthorization();

// 只公開專案內可安全展示的靜態資產，社群圖片仍由受控 endpoint 提供
// 圖鑑與商城素材是專案內的官方展示資產；社群上傳媒體仍只能由受控 endpoint 提供。
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/media")
        && !context.Request.Path.StartsWithSegments("/media/catalog")
        && !context.Request.Path.StartsWithSegments("/media/store"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next(context);
});

app.MapStaticAssets();

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
