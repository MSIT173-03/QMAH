using System.Text;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using QMAH.Infrastructure.Data;
using QMAH.Api.Infrastructure.Identity;
using QMAH.Infrastructure.Configuration;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

//增加GOOGLE API 9/17
using System.Security.Claims;


namespace QMAH.Api.Controllers.V1;



[Route("api/v1/account")]
[EnableRateLimiting("auth")]
public sealed class AccountController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    QmahDbContext db,
    IPasswordResetEmailSender emailSender,
    IOptions<QmahPasswordResetOptions> passwordResetOptions,
    IConfiguration configuration,
    ILogger<AccountController> logger) : ApiControllerBase
{
    [AllowAnonymous]
    [HttpGet("antiforgery-token")]
    public IActionResult GetAntiforgeryToken(
        [FromServices] IAntiforgery antiforgery,
        [FromServices] IWebHostEnvironment environment)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        if (string.IsNullOrWhiteSpace(tokens.RequestToken))
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "無法建立登入驗證資料");

        // Angular 需要讀取 request token，再以 X-XSRF-TOKEN header 送回 API。
        // 不直接把 ASP.NET Core 內部 cookie token 暴露給前端。
        // 開發環境固定不要求 Secure：QMAH.Api 一律以 https 執行，但透過 Angular dev server 的
        // proxy 轉送時瀏覽器端看到的是 http，Request.IsHttps 判斷的是 Kestrel 收到的請求（永遠
        // 是 https），Secure cookie 在該情境下無法穩定送回，登入狀態會不穩定地遺失。
        Response.Cookies.Append(
            "XSRF-TOKEN-API",
            tokens.RequestToken,
            new CookieOptions
            {
                HttpOnly = false,
                Secure = !environment.IsDevelopment(),
                SameSite = SameSiteMode.Lax,
                Path = "/",
                IsEssential = true
            });
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("capabilities")]
    public ActionResult<AccountCapabilitiesDto> GetCapabilities()
    {
        // integration: 只公開是否已設定 Google OAuth，不把 secret、client id 或 provider 細節送到前端。
        var googleLoginEnabled = !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"])
            && !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]);
        return Ok(new AccountCapabilitiesDto(googleLoginEnabled));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AccountSessionDto>> GetCurrentSession(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var user = await db.Users.AsNoTracking()
            .Where(item => item.Id == userId && item.Status == "ACTIVE")
            .Select(item => new { item.Email })
            .SingleOrDefaultAsync(cancellationToken);
        if (user?.Email is null)
            return Unauthorized();

        var nickname = await db.UserProfiles.AsNoTracking()
            .Where(profile => profile.UserId == userId)
            .Select(profile => profile.Nickname)
            .SingleOrDefaultAsync(cancellationToken);

        return Ok(new AccountSessionDto(userId, user.Email, nickname));
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        try
        {
            if (!await db.Database.CanConnectAsync(cancellationToken))
                return DatabaseUnavailable();

            var user = await userManager.FindByEmailAsync(request.Email.Trim());
            if (user is null || user.Status != "ACTIVE")
                return Unauthorized(new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "登入失敗",
                    Detail = "Email 或密碼錯誤。"
                });

            var result = await signInManager.PasswordSignInAsync(
                user,
                request.Password,
                request.RememberMe,
                lockoutOnFailure: true);
            if (!result.Succeeded)
                return Unauthorized(new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "登入失敗",
                    Detail = "Email 或密碼錯誤。"
                });

            return NoContent();
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
            when (QmahDatabaseDiagnostics.IsDatabaseFailure(exception))
        {
            logger.LogError(
                exception,
                "API 登入時無法連線到 QMAH 資料庫。目標：{DatabaseTarget}",
                QmahDatabaseDiagnostics.GetTarget(db));

            return DatabaseUnavailable();
        }
    }


    // =========================
    // Google 外部登入
    // =========================

    [AllowAnonymous]
    [HttpGet("google-login")]
    public IActionResult GoogleLogin()
    {
        if (string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"])
            || string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]))
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Google 登入目前不可用");
        }

        return StartExternalLogin(
            provider: "Google",
            callbackAction: nameof(GoogleCallback));
    }

    [AllowAnonymous]
    [HttpGet("google-callback")]
    public Task<IActionResult> GoogleCallback(
        string? remoteError = null,
        CancellationToken cancellationToken = default)
    {
        return HandleExternalLoginCallbackAsync(
            providerName: "Google",
            errorQueryName: "googleError",
            remoteError,
            cancellationToken);
    }


    // =========================
    // Logto 外部登入
    // =========================

    // Facebook → Logto → 直接 Facebook
    [AllowAnonymous]
    [HttpGet("logto-login")]
    public IActionResult LogtoLogin()
    {
        if (string.IsNullOrWhiteSpace(configuration["Authentication:Logto:Endpoint"])
            || string.IsNullOrWhiteSpace(configuration["Authentication:Logto:ClientId"])
            || string.IsNullOrWhiteSpace(configuration["Authentication:Logto:ClientSecret"]))
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Facebook 登入目前不可用");
        }

        return StartLogtoExternalLogin(
            connectorId: "facebook",
            callbackAction: nameof(LogtoCallback));
    }


    // Microsoft → Logto → 直接 Microsoft
    [AllowAnonymous]
    [HttpGet("microsoft-login")]
    public IActionResult MicrosoftLogin()
    {
        if (string.IsNullOrWhiteSpace(configuration["Authentication:Logto:Endpoint"])
            || string.IsNullOrWhiteSpace(configuration["Authentication:Logto:ClientId"])
            || string.IsNullOrWhiteSpace(configuration["Authentication:Logto:ClientSecret"]))
        {
            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Microsoft 登入目前不可用");
        }

        return StartLogtoExternalLogin(
            connectorId: "azuread",
            callbackAction: nameof(LogtoCallback));
    }


    [AllowAnonymous]
    [HttpGet("logto-callback")]
    public Task<IActionResult> LogtoCallback(
        string? remoteError = null,
        CancellationToken cancellationToken = default)
    {
        return HandleExternalLoginCallbackAsync(
            providerName: "Logto",
            errorQueryName: "logtoError",
            remoteError,
            cancellationToken);
    }


    // =========================
    // Logto：指定 Social Connector
    // 跳過 Logto 登入選擇畫面
    // =========================

    private IActionResult StartLogtoExternalLogin(
        string connectorId,
        string callbackAction)
    {
        var redirectUrl = Url.Action(
            callbackAction,
            "Account",
            values: null,
            protocol: Request.Scheme);

        var properties =
            signInManager.ConfigureExternalAuthenticationProperties(
                "Logto",
                redirectUrl);

   

        properties.Items["direct_sign_in"] =
            $"social:{connectorId}";

        return Challenge(properties, "Logto");
    }


    // =========================
    // 共用：啟動外部登入
    // =========================

    private IActionResult StartExternalLogin(
        string provider,
        string callbackAction)
    {
        var redirectUrl = Url.Action(
            callbackAction,
            "Account",
            values: null,
            protocol: Request.Scheme);

        var properties =
            signInManager.ConfigureExternalAuthenticationProperties(
                provider,
                redirectUrl);

        return Challenge(properties, provider);
    }


    // =========================
    // 共用：處理 Google / Logto callback
    // =========================

    private async Task<IActionResult> HandleExternalLoginCallbackAsync(
        string providerName,
        string errorQueryName,
        string? remoteError,
        CancellationToken cancellationToken)
    {
        var clientUrl =
            (configuration["Frontend:ClientUrl"] ?? "http://localhost:4200")
            .TrimEnd('/');

        string LoginErrorUrl()
            => $"{clientUrl}/login?{errorQueryName}=1";

        if (!string.IsNullOrWhiteSpace(remoteError))
        {
            logger.LogWarning(
                "{Provider} 登入失敗。RemoteError={RemoteError}",
                providerName,
                remoteError);

            return Redirect(LoginErrorUrl());
        }

        var info = await signInManager.GetExternalLoginInfoAsync();

        if (info is null)
        {
            logger.LogWarning(
                "{Provider} 登入失敗，無法取得 ExternalLoginInfo。",
                providerName);

            return Redirect(LoginErrorUrl());
        }

        // 已經綁定此外部登入
        var linkedUser = await userManager.FindByLoginAsync(
            info.LoginProvider,
            info.ProviderKey);

        if (linkedUser is not null
            && linkedUser.Status != "ACTIVE")
        {
            return Redirect(LoginErrorUrl());
        }

        var externalResult =
            await signInManager.ExternalLoginSignInAsync(
                info.LoginProvider,
                info.ProviderKey,
                isPersistent: true,
                bypassTwoFactor: false);

        if (externalResult.Succeeded)
        {
            var signedInUser =
                linkedUser
                ?? await userManager.FindByLoginAsync(
                    info.LoginProvider,
                    info.ProviderKey);

            if (signedInUser is null
                || signedInUser.Status != "ACTIVE")
            {
                await signInManager.SignOutAsync();

                return Redirect(LoginErrorUrl());
            }

            return Redirect($"{clientUrl}/member");
        }

        // 第一次使用此外部登入，需要 Email
        var email =
            info.Principal.FindFirstValue(ClaimTypes.Email);

        if (string.IsNullOrWhiteSpace(email))
        {
            logger.LogWarning(
                "{Provider} 未提供 Email claim。",
                providerName);

            return Redirect(LoginErrorUrl());
        }

        email = email.Trim();

        var user =
            await userManager.FindByEmailAsync(email);

        // -------------------------
        // 已有 QMAH 帳號 → 綁定外部登入
        // -------------------------

        if (user is not null)
        {
            if (user.Status != "ACTIVE")
                return Redirect(LoginErrorUrl());

            var addLoginResult =
                await userManager.AddLoginAsync(
                    user,
                    info);

            if (!addLoginResult.Succeeded)
            {
                logger.LogWarning(
                    "{Provider} 帳號綁定失敗。UserId={UserId} Errors={Errors}",
                    providerName,
                    user.Id,
                    string.Join(
                        ", ",
                        addLoginResult.Errors.Select(x => x.Code)));

                return Redirect(LoginErrorUrl());
            }

            await signInManager.SignInAsync(
                user,
                isPersistent: true);

            return Redirect($"{clientUrl}/member");
        }

        // -------------------------
        // 沒有 QMAH 帳號 → 建立會員
        // -------------------------

        var now = DateTime.UtcNow;

        user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };

        var createResult =
            await userManager.CreateAsync(user);

        if (!createResult.Succeeded)
        {
            logger.LogWarning(
                "{Provider} 會員建立失敗。Errors={Errors}",
                providerName,
                string.Join(
                    ", ",
                    createResult.Errors.Select(x => x.Code)));

            return Redirect(LoginErrorUrl());
        }

        var addExternalLoginResult =
            await userManager.AddLoginAsync(
                user,
                info);

        if (!addExternalLoginResult.Succeeded)
        {
            await userManager.DeleteAsync(user);

            logger.LogWarning(
                "{Provider} 外部登入資料建立失敗。",
                providerName);

            return Redirect(LoginErrorUrl());
        }

        var nickname =
            info.Principal.FindFirstValue(ClaimTypes.Name)
            ?? email.Split('@')[0];

        db.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            Nickname = nickname,
            Visibility = "PRIVATE",
            CreatedAt = now,
            UpdatedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);

        var roleResult =
            await userManager.AddToRoleAsync(
                user,
                "User");

        if (!roleResult.Succeeded)
        {
            logger.LogWarning(
                "{Provider} 新會員加入 User 角色失敗。UserId={UserId}",
                providerName,
                user.Id);

            return Redirect(LoginErrorUrl());
        }

        await signInManager.SignInAsync(
            user,
            isPersistent: true);

        return Redirect($"{clientUrl}/member");
    }






    private ActionResult DatabaseUnavailable()
    {
        return Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "資料庫無法連線",
            detail: $"目前無法連線到 QMAH 資料庫（{QmahDatabaseDiagnostics.GetTarget(db)}）。請確認 LocalDB／SQL Server instance 與 QMAH 資料庫已啟動並完成還原。");
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var email = request.Email.Trim();
        if (await userManager.FindByEmailAsync(email) is not null)
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Email 已註冊",
                Detail = "請使用其他 Email。"
            });

        var now = DateTime.UtcNow;
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = false,
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            foreach (var error in createResult.Errors)
                ModelState.AddModelError(string.Empty, error.Description);
            return ValidationProblem(ModelState);
        }

        db.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            Nickname = request.Nickname.Trim(),
            Visibility = "PRIVATE",
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync(cancellationToken);

        var roleResult = await userManager.AddToRoleAsync(user, "User");
        if (!roleResult.Succeeded)
        {
            foreach (var error in roleResult.Errors)
                ModelState.AddModelError(string.Empty, error.Description);
            return ValidationProblem(ModelState);
        }

        return Created("/api/v1/account/login", new { userId = user.Id });
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is not null && !string.IsNullOrWhiteSpace(user.Email))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var clientUrl = string.IsNullOrWhiteSpace(passwordResetOptions.Value.ClientUrl)
                ? "http://localhost:4200/reset-password"
                : passwordResetOptions.Value.ClientUrl;
            var resetUrl = $"{clientUrl.TrimEnd('/')}?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(encodedToken)}";
            try
            {
                await emailSender.SendAsync(user.Email, resetUrl, cancellationToken);
            }
            catch (OperationCanceledException)
                when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                // 忘記密碼端點對所有 Email 維持相同回應，避免從郵件服務錯誤反推出帳號是否存在。
                logger.LogError(exception, "密碼重設郵件傳送失敗。RecipientDomain={RecipientDomain}", GetEmailDomain(user.Email));
            }
        }

        // 不論帳號是否存在，都回傳相同結果，避免 Email enumeration。
        return Accepted(new { message = "如果帳號存在，密碼重設指示會送到註冊信箱。" });
    }

    private static string GetEmailDomain(string email)
    {
        var at = email.LastIndexOf('@');
        return at > 0 && at < email.Length - 1 ? email[(at + 1)..] : "unknown";
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<ActionResult> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "密碼重設失敗", detail: "重設連結無效或已過期。");

        string token;
        try
        {
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (Exception exception) when (exception is FormatException or ArgumentException)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "密碼重設失敗", detail: "重設連結格式無效。");
        }

        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "密碼重設失敗",
                detail: "重設連結無效、已過期，或新密碼不符合目前密碼政策。");
        }

        return NoContent();
    }
}
