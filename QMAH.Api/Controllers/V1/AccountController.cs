using System.Text;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Api.Infrastructure.Identity;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/account")]
[EnableRateLimiting("auth")]
public sealed class AccountController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    QmahDbContext db,
    IPasswordResetEmailSender emailSender,
    IConfiguration configuration) : ApiControllerBase
{
    [AllowAnonymous]
    [HttpGet("antiforgery-token")]
    public IActionResult GetAntiforgeryToken([FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        if (string.IsNullOrWhiteSpace(tokens.RequestToken))
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "無法建立登入驗證資料");

        // Angular 需要讀取 request token，再以 X-XSRF-TOKEN header 送回 API。
        // 不直接把 ASP.NET Core 內部 cookie token 暴露給前端。
        Response.Cookies.Append(
            "XSRF-TOKEN-API",
            tokens.RequestToken,
            new CookieOptions
            {
                HttpOnly = false,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                IsEssential = true
            });
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

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
            var clientUrl = configuration["PasswordReset:ClientUrl"]
                ?? "http://localhost:4200/reset-password";
            var resetUrl = $"{clientUrl.TrimEnd('/')}?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(encodedToken)}";
            await emailSender.SendAsync(user.Email, resetUrl, cancellationToken);
        }

        // 不論帳號是否存在，都回傳相同結果，避免 Email enumeration。
        return Accepted(new { message = "如果帳號存在，密碼重設指示會送到註冊信箱。" });
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
