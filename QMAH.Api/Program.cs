using System.IO.Compression;
using System.Threading.RateLimiting;

using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

using QMAH.Api.Infrastructure.Identity;
using QMAH.Api.Infrastructure.Media;
using QMAH.Infrastructure.Data;
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

// 本機設定檔只存開發環境的連線字串與 CORS 來源，不把個人差異寫進共用設定

var configuredMediaRoot = builder.Configuration["Media:RootPath"]
    ?? Path.Combine("..", "QMAH.Web", "wwwroot", "media");
var mediaRoot = Path.IsPathRooted(configuredMediaRoot)
    ? Path.GetFullPath(configuredMediaRoot)
    : Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, configuredMediaRoot));
builder.Services.Configure<MediaStorageOptions>(options => options.RootPath = mediaRoot);

// 使用 MVC 的 controller services 以提供內建 Anti-forgery filter；API 本身不建立 Razor View。
builder.Services.AddControllersWithViews(options =>
{
    // API 的 unsafe request 一律要求 Anti-forgery token；GET 不需要 token。
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
builder.Services.AddAntiforgery(options =>
{
    // 這是 ASP.NET Core 內部使用的 cookie token，不直接提供給前端讀取。
    // API 與 Web 使用不同名稱，避免雙啟動時互相覆蓋。
    options.Cookie.Name = ".QMAH.Api.Antiforgery";
    options.Cookie.HttpOnly = true;
    // 開發環境允許使用 http profile；其他環境仍強制 HTTPS Cookie。
    options.Cookie.SecurePolicy = cookieSecurePolicy;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.HeaderName = "X-XSRF-TOKEN";
});
builder.Services.AddResponseCompression(options =>
{
    // API 的 JSON 與文件回應可安全使用快速壓縮，降低前台資料載入量。
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
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// CORS 只允許設定檔列出的前端來源，使用 Cookie 時也不能使用萬用字元
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>()
        ?? ["http://localhost:4200", "https://localhost:4200"];

    if (allowedOrigins.Length == 0 || allowedOrigins.Any(string.IsNullOrWhiteSpace))
        throw new InvalidOperationException("Cors:AllowedOrigins 必須至少設定一個明確的前端來源。");

    options.AddPolicy("AngularClient", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
builder.Services.AddDbContext<QmahDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("QmahDatabase")
        ?? throw new InvalidOperationException(
            "Connection string 'QmahDatabase' was not found."));
});

// API 與 Web 共用會員資料表，但使用獨立 Cookie 名稱避免雙啟動互相覆蓋登入狀態
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
    // 後台停用帳號後，既有登入 cookie 也要在下一次 request 失效。
    options.ValidationInterval = TimeSpan.Zero;
});
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IPasswordResetEmailSender, PasswordResetEmailSender>();
builder.Services.AddScoped<IPasswordHasher<GameRoom>, PasswordHasher<GameRoom>>();

// 只有登入端點套用固定視窗限流，避免密碼嘗試拖慢其他 API 功能
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
    options.Cookie.Name = ".QMAH.Api.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = cookieSecurePolicy;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;
    options.LoginPath = "/api/v1/account/login";
    options.AccessDeniedPath = "/api/v1/account/access-denied";
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.WebHost.ConfigureKestrel(options =>
{
    // 同一個 localhost 可能先後啟動多個版本，保留有限上限讓舊 Cookie 有機會被清理
    options.Limits.MaxRequestHeadersTotalSize = 64 * 1024;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseResponseCompression();
app.UseHttpsRedirection();

// API 先完成路由與限流，再清除舊 Cookie，最後才進入 CORS、驗證與 controller
app.UseRouting();
app.UseRateLimiter();
app.UseQmahCookieRecovery(
    ".QMAH.Web.Auth",
    ".QMAH.Web.Antiforgery",
    ".QMAH.Api.Auth",
    ".QMAH.Api.Antiforgery");
app.UseCors("AngularClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.Run();
