using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public class AccountController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly QmahDbContext _context;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        QmahDbContext context)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
    }

    [HttpGet("/Account/Login")]
    public async Task<IActionResult> Login(
        string? returnUrl = null,
        CancellationToken cancellationToken = default)
    {
        ViewBag.ReturnUrl = returnUrl;
        await LoadLoginArtifactImagesAsync(cancellationToken);

        return View();
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
            await LoadLoginArtifactImagesAsync(cancellationToken);
            return View(model);
        }

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user == null)
        {
            ModelState.AddModelError(
                string.Empty,
                "Email 或密碼錯誤");

            await LoadLoginArtifactImagesAsync(cancellationToken);
            return View(model);
        }

        if (user.Status != "ACTIVE")
        {
            ModelState.AddModelError(
                string.Empty,
                "此帳號目前已停權");

            await LoadLoginArtifactImagesAsync(cancellationToken);
            return View(model);
        }

        var result = await _signInManager.PasswordSignInAsync(
            user,
            model.Password,
            model.RememberMe,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            ModelState.AddModelError(
                string.Empty,
                "Email 或密碼錯誤");

            await LoadLoginArtifactImagesAsync(cancellationToken);
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

    private async Task LoadLoginArtifactImagesAsync(CancellationToken cancellationToken)
    {
        var images = await _context.ArtifactQuestionEntries
            .AsNoTracking()
            .Where(entry => entry.IsEnabled && entry.Artifact.IsActive)
            .Select(entry => entry.Artifact.ThumbnailPath ?? entry.Artifact.PrimaryImagePath)
            .Where(path => path != null && path != string.Empty)
            .Distinct()
            .ToListAsync(cancellationToken);

        var imageArray = images
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => path!)
            .ToArray();

        for (var i = imageArray.Length - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (imageArray[i], imageArray[j]) = (imageArray[j], imageArray[i]);
        }

        ViewData["LoginArtifactImages"] = imageArray;
    }
}
