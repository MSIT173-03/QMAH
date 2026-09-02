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
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Security;
using QMAH.Infrastructure.Services.Economy;

var builder = WebApplication.CreateBuilder(args);
var cookieSecurePolicy = builder.Environment.IsDevelopment()
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

builder.Services
    .AddOptions<MediaDeliveryOptions>()
    .Bind(builder.Configuration.GetSection(MediaDeliveryOptions.SectionName));
builder.Services.AddSingleton<QmahMediaUrlResolver>();

// 本機設定檔只存開發環境的連線字串與展示選項，不進版本控制
var qmahDatabaseResolution = await QmahDatabaseConnectionResolver.ResolveAsync(
    builder.Configuration.GetConnectionString("QmahDatabase"),
    builder.Configuration.GetValue("QmahDatabaseDiscovery:Enabled", true));

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
        qmahDatabaseResolution.ConnectionString,
        sqlOptions => sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 2,
            maxRetryDelay: TimeSpan.FromSeconds(1),
            errorNumbersToAdd: null));
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
// EconomyService 負責會員單筆經濟規則；MiniGameService 負責四種玩法共用的開始、結算與獎勵契約。
// 批次資產作業另外保留活動主檔與篩選快照，讓營運中心能統計活動事件，且不取代逐會員帳本。
builder.Services.AddScoped<EconomyService>();
builder.Services.AddScoped<MiniGameService>();
builder.Services.AddScoped<BulkEconomyService>();

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

if (qmahDatabaseResolution.FoundTargets.Count > 1)
{
    app.Logger.LogWarning(
        "本機找到多個 QMAH 資料庫，依優先順序使用 {SelectedTarget}；候選：{FoundTargets}",
        qmahDatabaseResolution.Target,
        string.Join(", ", qmahDatabaseResolution.FoundTargets));
}
else if (qmahDatabaseResolution.UsedAutomaticDiscovery)
{
    app.Logger.LogInformation(
        "已自動找到 QMAH 資料庫：{SelectedTarget}",
        qmahDatabaseResolution.Target);
}
else
{
    app.Logger.LogInformation(
        "QMAH 資料庫目前目標：{SelectedTarget}",
        qmahDatabaseResolution.Target);
}

if (app.Environment.IsDevelopment())
{
    try
    {
        await DevelopmentAdminSeeder.ResetDevelopmentPasswordsAsync(
            app.Services,
            builder.Configuration);
    }
    catch (Exception exception)
        when (QmahDatabaseDiagnostics.IsDatabaseFailure(exception))
    {
        app.Logger.LogWarning(
            exception,
            "開發用帳號密碼初始化時無法連線資料庫；登入頁會顯示資料庫警告。目標：{DatabaseTarget}",
            qmahDatabaseResolution.Target);
    }
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
    catch (Exception exception)
        when (QmahDatabaseDiagnostics.IsDatabaseFailure(exception)
            && !context.RequestAborted.IsCancellationRequested)
    {
        app.Logger.LogError(
            exception,
            "後台 request 無法連線到 QMAH 資料庫。目標：{DatabaseTarget}",
            qmahDatabaseResolution.Target);

        if (context.Response.HasStarted)
        {
            throw;
        }

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store";

        var acceptsJson = context.Request.Headers.Accept.Any(value =>
            value?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true);
        if (context.Request.Path.StartsWithSegments("/api") || acceptsJson)
        {
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsJsonAsync(new
            {
                title = "資料庫無法連線",
                detail = "QMAH 資料庫目前無法連線，請確認 SQL Server 或 LocalDB 已啟動後再試。"
            });
            return;
        }

        var returnUrl = System.Net.WebUtility.HtmlEncode(
            $"{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}");
        var databaseTarget = System.Net.WebUtility.HtmlEncode(qmahDatabaseResolution.Target);
        var html = $$"""
            <!doctype html>
            <html lang="zh-Hant">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>資料庫無法連線｜QMAH</title></head>
            <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6f4;color:#24343b;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
              <dialog open style="width:min(34rem,calc(100% - 2rem));border:1px solid #d7e1e5;border-radius:16px;padding:2rem;box-shadow:0 18px 50px #24343b22">
                <p style="margin:0 0 .5rem;color:#b65c4e;font-weight:700">系統連線問題</p>
                <h1 style="margin:.25rem 0 1rem;font-size:1.6rem">資料庫無法連線</h1>
                <p style="line-height:1.7">目前無法連到 QMAH 資料庫（{{databaseTarget}}）。請確認 SQL Server／LocalDB 已啟動，或稍後重新載入。</p>
                <p><a href="{{returnUrl}}" style="display:inline-block;padding:.7rem 1rem;border-radius:8px;background:#3f6f86;color:#fff;text-decoration:none">重新載入</a></p>
              </dialog>
            </body>
            </html>
            """;
        await context.Response.WriteAsync(html);
    }
});

app.UseHttpsRedirection();

// 圖鑑與商城素材可公開展示，社群上傳媒體仍只能由受控 endpoint 提供
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

if (app.Environment.IsDevelopment())
{
    // 後台資產網址帶有內容版本，檔案異動後會自動換網址
    // 開發環境也允許瀏覽器重用相同版本，避免每次切頁重新下載整套樣式
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = context =>
        {
            var cacheControl = context.Context.Request.Query.ContainsKey("v")
                ? "public,max-age=31536000,immutable"
                : "public,max-age=3600,must-revalidate";

            context.Context.Response.Headers.CacheControl = cacheControl;
        }
    });
}

// 靜態資產處理完成後才進入路由、Cookie 與登入驗證
app.UseRouting();
app.UseRateLimiter();
app.UseQmahCookieRecovery(
    ".QMAH.Web.Auth",
    ".QMAH.Web.Antiforgery",
    ".QMAH.Api.Auth",
    ".QMAH.Api.Antiforgery");

app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
