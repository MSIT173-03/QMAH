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

// 註冊表單採用 Cloudflare Turnstile 人機驗證。
using System.Net.Http.Json;
using System.Text.Json.Serialization;


namespace QMAH.Api.Controllers.V1;



[Route("api/v1/account")]
public sealed class AccountController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    QmahDbContext db,
    IPasswordResetEmailSender emailSender,
    IOptions<QmahPasswordResetOptions> passwordResetOptions,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
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
    // 限流只套在會被猜密碼或灌請求的端點；me、capabilities、antiforgery-token 每次載入頁面都會呼叫，
    // 不能讓同一個網路出口的多位玩家共用額度而被擋住。
    [EnableRateLimiting("auth")]
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

            // 先驗證密碼（包含失敗鎖定），才告知此帳號需要信箱驗證；此步驟不建立 cookie。
            var passwordResult = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
            if (!passwordResult.Succeeded)
                return Unauthorized(new ProblemDetails { Status = 401, Title = "登入失敗", Detail = "Email 或密碼錯誤。" });

            if (!user.EmailConfirmed)
            {
                var problem = new ProblemDetails { Status = 403, Title = "信箱尚未驗證", Detail = "請先完成信箱驗證，再登入會員帳號。" };
                problem.Extensions["code"] = "email_verification_required";
                return StatusCode(403, problem);
            }

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

        if (!string.Equals(info.LoginProvider, providerName, StringComparison.Ordinal))
        {
            logger.LogWarning("{Provider} callback 收到非預期的外部登入來源。", providerName);
            return Redirect(LoginErrorUrl());
        }

        async Task<IActionResult> SignInExternalUserAsync()
        {
            var result = await signInManager.ExternalLoginSignInAsync(
                info.LoginProvider,
                info.ProviderKey,
                isPersistent: true,
                bypassTwoFactor: false);

            if (!result.Succeeded)
            {
                var failure = result.IsLockedOut ? "LockedOut"
                    : result.IsNotAllowed ? "NotAllowed"
                    : result.RequiresTwoFactor ? "RequiresTwoFactor"
                    : "Failed";
                logger.LogWarning("{Provider} 外部登入未完成。Reason={Reason}", providerName, failure);
                return Redirect(LoginErrorUrl());
            }

            var signedInUser = await userManager.FindByLoginAsync(info.LoginProvider, info.ProviderKey);
            if (signedInUser is null || signedInUser.Status != "ACTIVE")
            {
                await signInManager.SignOutAsync();
                return Redirect(LoginErrorUrl());
            }

            return Redirect($"{clientUrl}/member");
        }

        // 已經綁定此外部登入
        var linkedUser = await userManager.FindByLoginAsync(
            info.LoginProvider,
            info.ProviderKey);

        if (linkedUser is not null)
        {
            if (linkedUser.Status != "ACTIVE")
                return Redirect(LoginErrorUrl());

            // 已綁定會員的任何登入失敗都必須停止，不可轉入首次登入流程。
            return await SignInExternalUserAsync();
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

        // 首次外部登入依相同 Email 綁定既有會員，各環境使用一致規則。
        if (user is not null)
        {
            // 一般密碼會員須先完成信箱驗證，並保留停權與鎖定限制。
            if (!user.EmailConfirmed && await userManager.HasPasswordAsync(user))
                return Redirect($"{clientUrl}/login?{errorQueryName}=email_verification_required");
            if (user.Status != "ACTIVE"
                || !await signInManager.CanSignInAsync(user)
                || await userManager.IsLockedOutAsync(user))
                return Redirect(LoginErrorUrl());

            var linkResult = await userManager.AddLoginAsync(user, info);
            if (!linkResult.Succeeded)
                return Redirect(LoginErrorUrl());

            logger.LogInformation("已依相同 Email 建立 {Provider} 外部登入綁定。", providerName);
            return await SignInExternalUserAsync();
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
            EmailConfirmed = false,
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

        return await SignInExternalUserAsync();
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
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        // =========================
        // Cloudflare Turnstile 驗證
        // =========================

        if (string.IsNullOrWhiteSpace(request.TurnstileToken))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "安全驗證失敗",
                Detail = "請完成安全驗證後再註冊。"
            });
        }

        var turnstileSecret =
            configuration["Turnstile:SecretKey"];

        if (string.IsNullOrWhiteSpace(turnstileSecret))
        {
            logger.LogError(
                "Cloudflare Turnstile SecretKey 尚未設定。");

            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "安全驗證服務目前不可用");
        }

        var httpClient =
            httpClientFactory.CreateClient();

        try
        {
            using var verificationTimeout =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            verificationTimeout.CancelAfter(TimeSpan.FromSeconds(10));

            using var verifyResponse =
                await httpClient.PostAsJsonAsync(
                    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                    new
                    {
                        secret = turnstileSecret,
                        response = request.TurnstileToken
                    },
                    verificationTimeout.Token);

            if (!verifyResponse.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Cloudflare Turnstile Siteverify 無法正常回應。StatusCode={StatusCode}",
                    verifyResponse.StatusCode);

                return Problem(
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "安全驗證服務目前不可用");
            }

            var turnstileResult =
                await verifyResponse.Content
                    .ReadFromJsonAsync<TurnstileVerifyResponse>(
                        cancellationToken: verificationTimeout.Token);

            if (turnstileResult?.Success != true)
            {
                logger.LogWarning(
                    "Cloudflare Turnstile 驗證失敗。Errors={Errors}",
                    string.Join(
                        ", ",
                        turnstileResult?.ErrorCodes
                        ?? Array.Empty<string>()));

                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "安全驗證失敗",
                    Detail = "安全驗證無效或已過期，請重新驗證。"
                });
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Cloudflare Turnstile Siteverify 逾時。");

            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "安全驗證服務目前不可用");
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Cloudflare Turnstile Siteverify 請求失敗。");

            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "安全驗證服務目前不可用");
        }
        catch (System.Text.Json.JsonException exception)
        {
            logger.LogWarning(exception, "Cloudflare Turnstile Siteverify 回應格式無效。");

            return Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "安全驗證服務目前不可用");
        }

        // =========================
        // 原本的會員註冊流程
        // =========================

        var email = request.Email.Trim();

        if (await userManager.FindByEmailAsync(email) is not null)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Email 已註冊",
                Detail = "請使用其他 Email。"
            });
        }

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

        var createResult =
            await userManager.CreateAsync(
                user,
                request.Password);

        if (!createResult.Succeeded)
        {
            foreach (var error in createResult.Errors)
                ModelState.AddModelError(
                    string.Empty,
                    error.Description);

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

        await db.SaveChangesAsync(
            cancellationToken);

        var roleResult =
            await userManager.AddToRoleAsync(
                user,
                "User");

        if (!roleResult.Succeeded)
        {
            foreach (var error in roleResult.Errors)
                ModelState.AddModelError(
                    string.Empty,
                    error.Description);

            return ValidationProblem(ModelState);
        }

        var confirmationSent = await TrySendConfirmationAsync(user, cancellationToken);

        return Created(
            "/api/v1/account/login",
            new
            {
                userId = user.Id,
                requiresEmailConfirmation = true,
                confirmationEmailSent = confirmationSent
            });
    }

    [AllowAnonymous]
    [EnableRateLimiting("verificationEmail")]
    [HttpPost("resend-confirmation")]
    public async Task<ActionResult> ResendConfirmation(ResendConfirmationRequest request, CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is not null && user.Status == "ACTIVE" && !user.EmailConfirmed)
        {
            var check = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
            if (check.Succeeded)
                await TrySendConfirmationAsync(user, cancellationToken);
        }

        // 不透露帳號存在與否，也不從寄信服務的錯誤透露會員資料。
        return Accepted(new { message = "若帳號密碼正確、帳號可用且信箱尚未驗證，驗證信將寄到該信箱。請查看收件匣與垃圾郵件；未收到可稍後重試。" });
    }

    [AllowAnonymous]
    [EnableRateLimiting("verificationEmail")]
    [HttpPost("resend-confirmation-link")]
    public async Task<ActionResult> ResendConfirmationFromLink(ConfirmEmailRequest request, CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || user.Status != "ACTIVE"
            || !await IsValidConfirmationTokenAsync(user, request.Token))
            return Problem(statusCode: 400, title: "驗證連結無效", detail: "驗證連結無效或已過期，請從重新申請驗證信入口操作。");

        if (!user.EmailConfirmed)
            await TrySendConfirmationAsync(user, cancellationToken);
        return Accepted(new { message = "若此信箱尚未驗證，驗證信將寄到該信箱。" });
    }

    private async Task<bool> IsValidConfirmationTokenAsync(ApplicationUser user, string encodedToken)
    {
        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encodedToken)); }
        catch (Exception exception) when (exception is FormatException or ArgumentException) { return false; }
        return await userManager.VerifyUserTokenAsync(user, userManager.Options.Tokens.EmailConfirmationTokenProvider,
            UserManager<ApplicationUser>.ConfirmEmailTokenPurpose, token);
    }

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("confirm-email")]
    public async Task<ActionResult> ConfirmEmail(ConfirmEmailRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || user.Status != "ACTIVE")
            return Problem(statusCode: 400, title: "信箱驗證失敗", detail: "驗證連結無效或已過期，請重新寄送驗證信。");

        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token)); }
        catch (Exception exception) when (exception is FormatException or ArgumentException)
        {
            return Problem(statusCode: 400, title: "信箱驗證失敗", detail: "驗證連結無效或已過期，請重新寄送驗證信。");
        }

        // 即使信箱已驗證，也先檢查 token，不能接受任意連結。
        if (!await userManager.VerifyUserTokenAsync(user, userManager.Options.Tokens.EmailConfirmationTokenProvider,
                UserManager<ApplicationUser>.ConfirmEmailTokenPurpose, token))
            return Problem(statusCode: 400, title: "信箱驗證失敗", detail: "驗證連結無效或已過期，請重新寄送驗證信。");

        if (!user.EmailConfirmed && !(await userManager.ConfirmEmailAsync(user, token)).Succeeded)
            return Problem(statusCode: 400, title: "信箱驗證失敗", detail: "目前無法完成驗證，請稍後再試。");
        return NoContent();
    }

    private async Task<bool> TrySendConfirmationAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        try
        {
            var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
            var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var clientUrl = (configuration["Frontend:ClientUrl"] ?? "http://localhost:4200").TrimEnd('/');
            var confirmationUrl = $"{clientUrl}/verify-email?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(encodedToken)}";
            await emailSender.SendConfirmationAsync(user.Email!, confirmationUrl, cancellationToken);
            return true;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception exception)
        {
            logger.LogError(exception, "信箱驗證郵件傳送失敗。RecipientDomain={RecipientDomain}", GetEmailDomain(user.Email!));
            return false;
        }
    }

    [Authorize]
    [HttpGet("password-status")]
    public async Task<ActionResult> GetPasswordStatus()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null || user.Status != "ACTIVE") return Unauthorized();
        return Ok(new { hasPassword = await userManager.HasPasswordAsync(user) });
    }

    [Authorize]
    [EnableRateLimiting("auth")]
    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var user = await userManager.GetUserAsync(User);
        if (user is null || user.Status != "ACTIVE") return Unauthorized();

        if (!await userManager.HasPasswordAsync(user))
            return Problem(statusCode: 409, title: "尚未設定密碼", detail: "此帳號目前使用第三方登入，請透過忘記密碼寄送重設連結來設定本網站密碼。");

        // 修改密碼也受錯誤次數鎖定保護，避免利用已登入的 session 猜測目前密碼。
        var check = await signInManager.CheckPasswordSignInAsync(user, request.CurrentPassword, lockoutOnFailure: true);
        if (check.IsLockedOut)
            return Problem(statusCode: 423, title: "帳號暫時鎖定", detail: "密碼錯誤次數過多，請稍後再試或使用忘記密碼。");
        if (!check.Succeeded)
            return Problem(statusCode: 400, title: "修改密碼失敗", detail: "目前密碼不正確，或帳號目前無法修改密碼。");

        if (request.NewPassword == request.CurrentPassword)
            return Problem(statusCode: 400, title: "修改密碼失敗", detail: "新密碼不可與目前密碼相同。");

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                var message = error.Code switch
                {
                    "PasswordTooShort" => "新密碼長度不足。",
                    "PasswordRequiresUpper" => "新密碼須包含大寫英文字母。",
                    "PasswordRequiresLower" => "新密碼須包含小寫英文字母。",
                    "PasswordRequiresDigit" => "新密碼須包含數字。",
                    "PasswordRequiresNonAlphanumeric" => "新密碼須包含特殊符號。",
                    "PasswordMismatch" => "目前密碼不正確。",
                    _ => "密碼更新失敗，請確認新密碼規則或稍後再試。"
                };
                ModelState.AddModelError(nameof(request.NewPassword), message);
            }
            return ValidationProblem(ModelState);
        }

        // ChangePasswordAsync 更新 security stamp，使其他既有 cookie 在下次驗證時失效。
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [AllowAnonymous]
    [EnableRateLimiting("auth")]
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
    [EnableRateLimiting("auth")]
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

    // =========================
    // Cloudflare Turnstile 回應
    // =========================
    private sealed class TurnstileVerifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("error-codes")]
        public string[] ErrorCodes { get; set; } = Array.Empty<string>();
    }

}
