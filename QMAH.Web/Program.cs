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

var builder = WebApplication.CreateBuilder(args);
var cookieSecurePolicy = builder.Environment.IsDevelopment()
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

builder.Services.AddControllersWithViews(options =>
{
    // 所有非 GET MVC Action 預設驗證 Anti-forgery token。
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    options.Filters.AddService<AdminAuditLogFilter>();
});
// CSS、JavaScript、HTML、JSON 與 SVG 維持可拆分管理，傳輸時再用快速壓縮降低載入成本。
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
builder.Services.Configure<SecurityStampValidatorOptions>(options =>
{
    // 會員被後台停用後，既有登入 cookie 也要在下一次 request 失效。
    options.ValidationInterval = TimeSpan.Zero;
});
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
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

app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

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
