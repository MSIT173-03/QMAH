using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[EnableRateLimiting("auth")]
public class AccountController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly QmahDbContext _context;
    private readonly QmahMediaStoragePaths _mediaPaths;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        QmahDbContext context,
        QmahMediaStoragePaths mediaPaths,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
        _mediaPaths = mediaPaths;
        _logger = logger;
    }

    [HttpGet("/Account/Login")]
    public async Task<IActionResult> Login(
        string? returnUrl = null,
        CancellationToken cancellationToken = default)
    {
        ViewBag.ReturnUrl = returnUrl;

        if (!await CanConnectToDatabaseAsync(cancellationToken))
        {
            AddDatabaseUnavailableError();
        }

        LoadLoginArtifactImages(cancellationToken);

        return View(new LoginViewModel());
    }

    [HttpPost("/Account/Login")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(
        LoginViewModel model,
        string? returnUrl = null,
        CancellationToken cancellationToken = default)
    {
        ViewBag.ReturnUrl = returnUrl;

        if (!ModelState.IsValid)
        {
            LoadLoginArtifactImages(cancellationToken);
            return View(model);
        }

        if (!await CanConnectToDatabaseAsync(cancellationToken))
        {
            return DatabaseUnavailableView(model, cancellationToken);
        }

        try
        {
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user == null)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Email 或密碼錯誤");

                LoadLoginArtifactImages(cancellationToken);
                return View(model);
            }

            if (user.Status != "ACTIVE")
            {
                ModelState.AddModelError(
                    string.Empty,
                    "此帳號目前已停權");

                LoadLoginArtifactImages(cancellationToken);
                return View(model);
            }

            var result = await _signInManager.PasswordSignInAsync(
                user,
                model.Password,
                model.RememberMe,
                lockoutOnFailure: true);

            if (!result.Succeeded)
            {
                ModelState.AddModelError(
                    string.Empty,
                    "Email 或密碼錯誤");

                LoadLoginArtifactImages(cancellationToken);
                return View(model);
            }

            // 管理員 → 後台首頁
            if (!await _userManager.IsInRoleAsync(user, "Admin"))
            {
                // 本專案目前只有管理後台，不提供一般會員前台。
                await _signInManager.SignOutAsync();
                return RedirectToAction(nameof(AccessDenied));
            }

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            {
                return LocalRedirect(returnUrl);
            }

            return RedirectToAction("Index", "Home", new { area = "" });
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
            when (QmahDatabaseDiagnostics.IsDatabaseFailure(exception))
        {
            _logger.LogError(
                exception,
                "登入時無法連線到 QMAH 資料庫。目標：{DatabaseTarget}",
                QmahDatabaseDiagnostics.GetTarget(_context));

            return DatabaseUnavailableView(model, cancellationToken);
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();

        return Redirect("/Account/Login");
    }

    [HttpGet]
    public IActionResult AccessDenied()
    {
        return View();
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public IActionResult Register()
    {
        return View();
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // Email 是否已經被使用
        var existingUser =
            await _userManager.FindByEmailAsync(model.Email);

        if (existingUser != null)
        {
            ModelState.AddModelError(
                nameof(model.Email),
                "此 Email 已經註冊。");

            return View(model);
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = model.Email.Trim(),
            Email = model.Email.Trim(),
            EmailConfirmed = false,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // 用 Identity 建帳號，不直接自己寫 PasswordHash
        var result = await _userManager.CreateAsync(
            user,
            model.Password);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                string message = error.Code switch
                {
                    "PasswordRequiresNonAlphanumeric"
                        => "密碼至少需要一個特殊符號，例如 ! @ # $",

                    "PasswordRequiresLower"
                        => "密碼至少需要一個小寫英文字母。",

                    "PasswordRequiresUpper"
                        => "密碼至少需要一個大寫英文字母。",

                    "PasswordRequiresDigit"
                        => "密碼至少需要一個數字。",

                    "PasswordTooShort"
                        => "密碼長度不足。",

                    "DuplicateEmail"
                        => "此 Email 已經被使用。",

                    "DuplicateUserName"
                        => "此 Email 已經被使用。",

                    _ => error.Description
                };

                ModelState.AddModelError("", message);
            }

            return View(model);
        }

        // 建立會員 Profile
        var profile = new UserProfile
        {
            UserId = user.Id,
            Nickname = model.Nickname.Trim(),
            AvatarPath = null,
            Bio = null,
            Visibility = "PRIVATE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.UserProfiles.Add(profile);

        await _context.SaveChangesAsync();

        // 一般註冊會員加入 User 角色
        var roleResult =
            await _userManager.AddToRoleAsync(user, "User");

        if (!roleResult.Succeeded)
        {
            foreach (var error in roleResult.Errors)
            {
                ModelState.AddModelError(
                    "",
                    error.Description);
            }

            return View(model);
        }

        return RedirectToAction(nameof(Login));
    }

    private void LoadLoginArtifactImages(CancellationToken cancellationToken)
    {
        // 登入頁的裝飾圖片不應等待資料庫連線，直接從已匯入的靜態縮圖挑選
        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            // 與 API、後台靜態檔案共用媒體根目錄，避免搬移媒體後圖片牆變成空白。
            var catalogRoot = Path.Combine(_mediaPaths.PublicRoot, "catalog");
            if (!Directory.Exists(catalogRoot))
            {
                ViewData["LoginArtifactImages"] = Array.Empty<string>();
                return;
            }

            var images = Directory
                .EnumerateDirectories(catalogRoot)
                .SelectMany(category => Directory.EnumerateFiles(category, "thumbnail.jpg", SearchOption.AllDirectories)
                    .OrderBy(_ => Random.Shared.Next()).Take(3))
                .OrderBy(_ => Random.Shared.Next())
                .Take(24)
                .Select(file => "/media/" + Path.GetRelativePath(_mediaPaths.PublicRoot, file)
                    .Replace(Path.DirectorySeparatorChar, '/')
                    .Replace(Path.AltDirectorySeparatorChar, '/'))
                .ToArray();

            ViewData["LoginArtifactImages"] = images;
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            ViewData["LoginArtifactImages"] = Array.Empty<string>();
        }
        catch (IOException)
        {
            // 裝飾圖片讀取失敗時仍要讓登入表單正常出現
            ViewData["LoginArtifactImages"] = Array.Empty<string>();
        }
        catch (UnauthorizedAccessException)
        {
            // 裝飾圖片沒有權限時仍要讓登入表單正常出現
            ViewData["LoginArtifactImages"] = Array.Empty<string>();
        }
    }

    private async Task<bool> CanConnectToDatabaseAsync(
        CancellationToken cancellationToken)
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync(cancellationToken);

            if (!canConnect)
            {
                _logger.LogWarning(
                    "QMAH 登入頁無法連線到資料庫。目標：{DatabaseTarget}",
                    QmahDatabaseDiagnostics.GetTarget(_context));
            }

            return canConnect;
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "QMAH 登入頁檢查資料庫時發生連線錯誤。目標：{DatabaseTarget}",
                QmahDatabaseDiagnostics.GetTarget(_context));

            return false;
        }
    }

    private void AddDatabaseUnavailableError()
    {
        var message =
            $"資料庫無法連線（{QmahDatabaseDiagnostics.GetTarget(_context)}）。請確認該 SQL Server instance 中已還原 QMAH，或檢查 QMAH.Web/appsettings.Local.json。";

        ViewData["DatabaseWarning"] = message;
        ModelState.AddModelError(
            string.Empty,
            message);
    }

    private IActionResult DatabaseUnavailableView(
        LoginViewModel model,
        CancellationToken cancellationToken)
    {
        AddDatabaseUnavailableError();
        LoadLoginArtifactImages(cancellationToken);
        return View(model);
    }
}
