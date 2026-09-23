using System.IO.Compression;
using System.Security.Claims;
using System.Threading.RateLimiting;

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

using QMAH.Api.Infrastructure.Identity;
using QMAH.Api.Infrastructure.Media;
using QMAH.Api.Infrastructure.Moderation;
using QMAH.Api.Infrastructure.OpenApi;
using QMAH.Api.Services;
using QMAH.Infrastructure.Configuration;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Development;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Security;
using QMAH.Infrastructure.Services.Common;
using QMAH.Infrastructure.Services.Economy;
using QMAH.Infrastructure.Services.Game;
using QMAH.Infrastructure.Services.Social;

using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
// ASP.NET Core 已先載入 appsettings.json、環境別設定與環境變數。
// Local 檔最後加入，因此只要檔案存在就具有最高優先權，方便每位組員覆寫連線與前台來源；部署環境不應放置此檔。
// 開發環境固定不要求 Secure：QMAH.Api 一律以 https launch profile 執行，但 QMAH.Client 的
// Angular dev server（ng serve）預設是 http，透過 proxy.conf.json 轉送時瀏覽器端看到的其實是
// http，用 SameAsRequest 會依 Kestrel 收到的 request（永遠是 https）判斷，導致 cookie 被標成
// Secure，卻沒有穩定的辦法送回純 http 的 4200——會員登入狀態因此不穩定地遺失。
var cookieSecurePolicy = builder.Environment.IsDevelopment()
    ? CookieSecurePolicy.None
    : CookieSecurePolicy.Always;

builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true);

builder.Services
    .AddOptions<QmahPasswordResetOptions>()
    .Bind(builder.Configuration.GetSection(QmahPasswordResetOptions.SectionName));
builder.Services
    .AddOptions<QmahMailjetOptions>()
    .Bind(builder.Configuration.GetSection(QmahMailjetOptions.SectionName));

// 先嘗試設定檔指定的連線；失敗時才依 resolver 的候選順序尋找本機名稱為 QMAH 的 SQL Server／LocalDB。
// 其他需要直接存取資料庫的 host 應重用 resolver，避免 Web、API 與工具程式各自猜測不同 instance。
var qmahDatabaseResolution = await QmahDatabaseConnectionResolver.ResolveAsync(
    builder.Configuration.GetConnectionString("QmahDatabase"),
    builder.Configuration.GetValue("QmahDatabaseDiscovery:Enabled", true));

var configuredMediaRoot = builder.Configuration["Media:RootPath"]
    ?? Path.Combine("..", "QMAH.Web", "wwwroot", "media");
var mediaRoot = Path.IsPathRooted(configuredMediaRoot)
    ? Path.GetFullPath(configuredMediaRoot)
    : Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, configuredMediaRoot));
builder.Services.Configure<MediaStorageOptions>(options => options.RootPath = mediaRoot);
builder.Services
    .AddOptions<MediaDeliveryOptions>()
    .Bind(builder.Configuration.GetSection(MediaDeliveryOptions.SectionName));
// 儲存路徑與公開網址刻意分開：檔案可先留在本機，公開網址則能由設定切換為 CDN。
// Controller 只保存相對 media key，回傳 DTO 時交由 resolver 產生網址，日後搬移檔案不必逐筆改資料庫。
builder.Services.AddSingleton<QmahMediaUrlResolver>();

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
// OpenAPI transformer 集中補上 Cookie security scheme 與各 operation 的安全需求。
// 新增 API 時仍應提供量身訂作的 summary／description；共用安全 metadata 不應散落在每個 Controller 重複維護。
var openApiOptions = builder.Configuration
    .GetSection("OpenApi")
    .Get<QmahOpenApiOptions>() ?? new QmahOpenApiOptions();
builder.Services.AddOpenApi(options =>
{
    var transformer = new QmahOpenApiSecurityTransformer(
        ".QMAH.Api.Auth",
        openApiOptions);
    options.AddDocumentTransformer(transformer);
    options.AddOperationTransformer(transformer);
});

// CORS 只允許設定檔列出的前端來源，使用 Cookie 時也不能使用萬用字元。
// 新增 Angular 開發埠、Azure 網站或 CDN 網域時修改 Cors:AllowedOrigins 即可，不需改動此處程式碼。
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
    // Retry 僅處理短暫 SQL 錯誤；Service 若自行開 transaction，必須以 execution strategy 包住完整交易，確保不會只重做部分帳本異動。
    options.UseSqlServer(
        qmahDatabaseResolution.ConnectionString,
        sqlOptions => sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 2,
            maxRetryDelay: TimeSpan.FromSeconds(1),
            errorNumbersToAdd: null));
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

var authenticationBuilder = builder.Services.AddAuthentication();
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];

if (!string.IsNullOrWhiteSpace(googleClientId)
    && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authenticationBuilder.AddGoogle(options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
        options.SignInScheme = IdentityConstants.ExternalScheme;
    });
}
else
{
    // integration: Google OAuth 為選用功能，缺少設定時不可阻止 API 啟動。
    builder.Logging.AddFilter("Microsoft.AspNetCore.Authentication", LogLevel.Warning);
}


var logtoEndpoint = builder.Configuration["Authentication:Logto:Endpoint"];
var logtoClientId = builder.Configuration["Authentication:Logto:ClientId"];
var logtoClientSecret = builder.Configuration["Authentication:Logto:ClientSecret"];

if (!string.IsNullOrWhiteSpace(logtoEndpoint)
    && !string.IsNullOrWhiteSpace(logtoClientId)
    && !string.IsNullOrWhiteSpace(logtoClientSecret))
{
    authenticationBuilder.AddOpenIdConnect("Logto", "Logto", options =>
    {
        options.Authority = $"{logtoEndpoint.TrimEnd('/')}/oidc";
        options.ClientId = logtoClientId;
        options.ClientSecret = logtoClientSecret;

        options.ResponseType = "code";
        options.SignInScheme = IdentityConstants.ExternalScheme;

        options.CallbackPath = "/Callback";

        options.SaveTokens = true;
        options.GetClaimsFromUserInfoEndpoint = true;

        options.Scope.Clear();
        options.Scope.Add("openid");
        options.Scope.Add("profile");
        options.Scope.Add("email");
        options.Events = new OpenIdConnectEvents
        {
            OnRedirectToIdentityProvider = context =>
            {
                if (context.Properties.Items.TryGetValue(
                        "direct_sign_in",
                        out var directSignIn)
                    && !string.IsNullOrWhiteSpace(directSignIn))
                {
                    context.ProtocolMessage.SetParameter(
                        "direct_sign_in",
                        directSignIn);
                }

                return Task.CompletedTask;
            }
        };
    });
}



builder.Services.Configure<SecurityStampValidatorOptions>(options =>
{
    // 後台停用帳號後，既有登入 cookie 也要在下一次 request 失效。
    options.ValidationInterval = TimeSpan.Zero;
});
builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient<IPasswordResetEmailSender, PasswordResetEmailSender>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IPasswordHasher<GameRoom>, PasswordHasher<GameRoom>>();
// 使用 DbContext、目前會員或 request 資訊的服務採 Scoped；只有確定無狀態且 thread-safe 的元件才可註冊 Singleton。
// 新增跨系統規則時放進 Infrastructure service，Controller 只負責輸入驗證與 HTTP response，Web 後台也能重用同一套規則。
// API 與管理後台共用經濟領域服務；交易帳本與 Mini Game 獎勵在服務層保持一致。
builder.Services.AddScoped<EconomyService>();
builder.Services.AddScoped<MiniGameService>();
// 活動與私人房間共用同一套加碼與邀請服務，確保實際發放、資產扣除與交易流水一致。
builder.Services.AddScoped<CommunityRewardService>();
builder.Services.AddScoped<GameRoomInvitationService>();
builder.Services.AddScoped<DailyActivityService>();
// integration: 房間生命週期由背景 worker 定期推進，和 HTTP 請求共用同一個 scoped service；
// 不依賴前端持續輪詢，部署到不同主機時也只需沿用既有 DI 設定。
builder.Services.AddScoped<GameRoomLifecycleService>();
builder.Services.AddHostedService<GameRoomLifecycleWorker>();
// Social 站內通知：活動審核、檢舉處理等共用同一套排隊寫入方式，由各自的 SaveChangesAsync 一併提交。
builder.Services.AddScoped<INotificationService, SocialNotificationService>();
// 圖鑑點擊社群入口需要在同一個交易中確保討論串與第一則留言，
// 由 Infrastructure service 集中處理，避免 Controller 自己重複維護交易與通知規則。
builder.Services.AddScoped<ArtifactDiscussionService>();
// 新增貼文/留言時用 SimHash 擋掉跟最近內容太像的洗版貼文；只有 API 這邊有公開發文入口，Web 後台不用註冊。
builder.Services.AddScoped<ContentSimilarityService>();
// 違規關鍵字表：Aho-Corasick 自動機建一次可以重複用，註冊 Singleton；內部用 IServiceScopeFactory
// 自己開 scope 存取 QmahDbContext，重新載入關鍵字時不用依賴目前請求的 scope。
builder.Services.AddSingleton<KeywordFilterService>();
// SimHash 比對天數／相似度門檻：跟 KeywordFilterService 一樣快取目前生效值，
// 後台改設定後由 QMAH.Web 的 ContentKeywordAdminController 呼叫 ReloadAsync 更新，不用重啟服務。
builder.Services.AddSingleton<ContentModerationSettingsService>();
// AI 內容審查（OpenAI Moderation，omni-moderation-latest）：只由 AiContentReviewWorker 背景呼叫，
// 不會出現在發文/留言的同步路徑上，外部 API 逾時或額度用完最多讓審查排程晚一點處理，不影響發文。
builder.Services.AddHttpClient<IAiContentReviewService, OpenAiContentReviewService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHostedService<AiContentReviewWorker>();

// 只有登入端點跟發文/留言端點套用固定視窗限流：
// 登入端點防止密碼嘗試拖慢其他 API 功能；發文/留言端點是緊急的洗版防護——
// 短時間內狂發文章時，直接在這裡擋掉，不會走到 SimHash 比對／資料庫查詢，
// 避免真的有人短時間灌爆時，反而是「查重複」那些查詢把資料庫拖垮。
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        var isAuthEndpoint = context.HttpContext.Request.Path.StartsWithSegments("/api/v1/account");
        context.HttpContext.Response.ContentType = "application/problem+json; charset=utf-8";
        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = isAuthEndpoint ? "登入嘗試過於頻繁" : "操作過於頻繁",
            Detail = isAuthEndpoint ? "請稍後再試。" : "發文/留言速度過快，請稍後再試。"
        }, cancellationToken);
    };
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
    // 以登入帳號 Id 分桶（而不是 IP），因為要擋的是「同一個帳號」短時間狂發，不是同一個網路出口。
    options.AddPolicy("socialContent", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
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
        return context.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "尚未登入或登入狀態已失效",
                Detail = "此 API 需要有效的會員登入狀態。"
            },
            options: null,
            contentType: "application/problem+json");
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return context.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "沒有執行此操作的權限",
                Detail = "目前登入帳號沒有使用此 API 的權限。"
            },
            options: null,
            contentType: "application/problem+json");
    };
});

builder.WebHost.ConfigureKestrel(options =>
{
    // 同一個 localhost 可能先後啟動多個版本，保留有限上限讓舊 Cookie 有機會被清理
    options.Limits.MaxRequestHeadersTotalSize = 64 * 1024;
});

var app = builder.Build();

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
            "開發用帳號密碼初始化時無法連線資料庫；登入仍會回報資料庫錯誤。目標：{DatabaseTarget}",
            qmahDatabaseResolution.Target);
    }
}

// 連線解析只選擇既有資料庫，不會自動建立或套用 migration；正式 Schema 仍由版本化 SQL 控制。
// 多個候選同時存在時記錄實際採用目標，方便核對 SSMS 與應用程式是否正在查看同一套 QMAH。
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
    app.Logger.LogInformation("公開媒體根目錄：{MediaRoot}", mediaRoot);
    if (!Directory.Exists(mediaRoot))
    {
        app.Logger.LogWarning(
            "Media:RootPath 不存在，/media/catalog 與 /media/store 將回傳 404。路徑：{MediaRoot}",
            mediaRoot);
    }
    else
    {
        foreach (var segment in new[] { "catalog", "store" })
        {
            var segmentPath = Path.Combine(mediaRoot, segment);
            if (!Directory.Exists(segmentPath))
            {
                app.Logger.LogWarning(
                    "資料庫可能包含 /media/{Segment} 圖片路徑，但本機公開媒體資料夾不存在：{SegmentPath}",
                    segment,
                    segmentPath);
            }
        }
    }
}

// 使用者切換頁面／重新整理時，瀏覽器會直接中止尚未完成的舊請求（例如貼文列表還沒回應就跳走）。
// EF Core 收到這個中止會丟出 OperationCanceledException，這是正常現象、不是例外狀況，
// 客戶端本來就不會再理會這個回應了，所以放在最外層直接吞掉，避免被當成未處理例外噴到主控台或開發例外頁。
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
    }
    catch (Exception exception)
        when (QmahDatabaseDiagnostics.IsDatabaseFailure(exception)
            && !context.RequestAborted.IsCancellationRequested)
    {
        // integration: API 依賴資料庫的單一請求失敗時只回傳 503，不能讓例外穿透成整個 Host 的未處理錯誤。
        // 這讓登入、型錄、遊戲與其他不依賴該次查詢的功能仍可繼續服務；資料庫恢復後也能直接重試。
        app.Logger.LogError(
            exception,
            "API request 無法連線到 QMAH 資料庫。目標：{DatabaseTarget}",
            qmahDatabaseResolution.Target);

        if (context.Response.HasStarted)
        {
            throw;
        }

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.ContentType = "application/problem+json; charset=utf-8";
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = "資料庫無法連線",
            Detail = "QMAH 資料庫目前無法連線，請稍後再試。"
        });
    }
});

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseResponseCompression();
app.UseHttpsRedirection();

// API＋Angular 前台不需要啟動 QMAH.Web 才能顯示公開圖鑑與商城圖片。
// 只掛載 catalog/store 兩個公開根目錄；uploads、社群媒體與其他私人檔案不由靜態檔案中介軟體暴露。
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
if (Directory.Exists(mediaRoot))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(mediaRoot),
        RequestPath = "/media",
        OnPrepareResponse = context =>
        {
            context.Context.Response.Headers.CacheControl =
                context.Context.Request.Query.ContainsKey("v")
                    ? "public,max-age=31536000,immutable"
                    : "public,max-age=3600,must-revalidate";
        }
    });
}

// 順序不可任意交換：先選路由與限流，再套 CORS，接著建立登入身分並執行授權，最後才進 Controller。
// 需要讀取 User／Role 的新 middleware 放在 Authentication 後；需要讓瀏覽器看見錯誤回應的 middleware 也必須受 CORS 包覆。
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
app.Use(async (context, next) =>
{
    var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
    var tokens = antiforgery.GetAndStoreTokens(context);

    var secure = cookieSecurePolicy switch
    {
        CookieSecurePolicy.Always => true,
        CookieSecurePolicy.None => false,
        _ => context.Request.IsHttps, // SameAsRequest
    };

    context.Response.Cookies.Append("XSRF-TOKEN-API", tokens.RequestToken!, new CookieOptions
    {
        HttpOnly = false, // 刻意不是 HttpOnly，就是要給前端 JS 讀
        Secure = secure,
        SameSite = SameSiteMode.Lax,
    });

    await next(context);
});
app.MapControllers();

if (app.Environment.IsDevelopment() || openApiOptions.Enabled)
{
    // 本機預設提供 OpenAPI 與 Scalar 測試頁；其他環境必須由設定明確開啟，避免無意公開內部契約介面。
    // 新增 API 後可在此頁直接確認 route、request body、response 與登入需求是否正確產生。
    app.MapOpenApi();
    if (app.Environment.IsDevelopment() || openApiOptions.ScalarEnabled)
        app.MapScalarApiReference();
}

app.Run();
