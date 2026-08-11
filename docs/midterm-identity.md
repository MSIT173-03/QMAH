# 期中 Identity 與會員資料管理

期中專題製作範圍以五個 Area 的 CRUD 後台為主。Identity 負責登入身分、後台存取權限，以及程式取得目前使用者的標準方式

## 期中專題製作範圍

- 各 Area 完成所屬後台 CRUD
- 會員管理可查看帳號，並新增、查詢、修改與刪除 `UserProfiles`、`UserAddresses` 等會員業務資料
- Email、鎖定狀態與角色等 Identity 資料透過 `UserManager`、`RoleManager` 操作
- 後台需要授權時，Controller 可取得目前登入者的 `UserId`

共用後台的登入頁、登出按鈕、Cookie 設定與 `Admin` 授權可在最後整合階段集中完成。各 Area 開發期間不必各自建立一套登入流程，但 Controller 與 View 不得假設任意 `UserId`，也不得直接修改 Identity 系統表。

登入整合延後不影響會員 CRUD。會員 Area 仍需完成帳號清單、會員資料與地址等管理功能，並使用本文件規定的 Identity API 與 `QmahDbContext` 分工。

期中專題不包含公開註冊、Email 驗證、忘記密碼、寄信、雙因素驗證、第三方登入、Claim／Token 管理介面與複雜角色編輯器。這些功能可沿用既有 Identity 結構擴充，不需要預先新增資料表

## 帳號資料分成兩種

| 資料 | 怎麼操作 | 例子 |
| --- | --- | --- |
| 登入憑證與角色 | `UserManager`、`SignInManager`、`RoleManager` | Email、密碼、鎖定、角色 |
| QMAH 會員資料 | `QmahDbContext` | 暱稱、簡介、地址、通知、成就 |

`AspNetUserLogins` 與 `AspNetUserTokens` 的用途、複合主鍵與 Entity 類型由 ASP.NET Core Identity 定義；schema 名稱與欄位長度可依資料庫設定。QMAH 將 `LoginProvider`、`ProviderKey` 與 Token `Name` 設為 `nvarchar(128)`，並在 `Program.cs` 設定 `options.Stores.MaxLengthForKeys = 128`。這是 Identity 官方模型用來避免複合主鍵超過資料庫索引長度的設定，不是任意縮短登入資料。

欄位對照可以依 SQL Server 調整，但 Identity 的主鍵組合與登入流程不能自行改寫。密碼、角色、Claim、Login 與 Token 仍透過框架 API 操作。

不要用一般 CRUD 直接改 `AspNetUsers.PasswordHash`、`AspNetUserRoles` 或 Token。Identity 還要同步正規化欄位、安全戳記與密碼雜湊，直接改資料表很容易留下無法登入的帳號

`Program.cs` 已完成 Identity DI、唯一 Email 規則、登入路徑 `/User/Account/Login` 與拒絕存取路徑 `/User/Account/AccessDenied`。最後整合登入頁時不需要再次註冊另一套 Identity。

## 參考資料庫帳號

Release 參考資料庫包含 8 個教學帳號與 `Admin`、`User` 兩個角色

| 帳號 | 角色 | 用途 |
| --- | --- | --- |
| `admin@qmah.local` | `Admin` | 後台登入與管理功能 |
| `catalog@qmah.local` | `User` | 圖鑑情境 |
| `game@qmah.local` | `User` | 遊戲情境 |
| `social@qmah.local` | `User` | 社群情境 |
| `store@qmah.local` | `User` | 商城情境 |
| `user@qmah.local` | `User` | 會員情境 |
| `player-a@qmah.local` | `User` | 遊戲玩家情境 |
| `player-b@qmah.local` | `User` | 遊戲玩家情境 |

教學帳號共用密碼：`QmahDemo2026!`

這組密碼只用於本機課程資料庫。若網站部署到可由外部連線的環境，必須先更換密碼

## Login ViewModel

`Areas/User/ViewModels/LoginViewModel.cs`

```csharp
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.User.ViewModels;

public sealed class LoginViewModel
{
    [Required(ErrorMessage = "請輸入 Email")]
    [EmailAddress(ErrorMessage = "Email 格式不正確")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入密碼")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "保持登入")]
    public bool RememberMe { get; set; }
}
```

ViewModel 只接收登入頁需要的三個欄位。畫面不會接觸 `ApplicationUser.PasswordHash` 或其他 Identity 內部欄位

## 登入與登出 Controller 參考

`Areas/User/Controllers/AccountController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public sealed class AccountController : Controller
{
    private readonly SignInManager<ApplicationUser> _signInManager;

    public AccountController(SignInManager<ApplicationUser> signInManager)
    {
        _signInManager = signInManager;
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel());
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(
        LoginViewModel input,
        string? returnUrl = null)
    {
        if (!ModelState.IsValid)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View(input);
        }

        var result = await _signInManager.PasswordSignInAsync(
            input.Email.Trim(),
            input.Password,
            input.RememberMe,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            ModelState.AddModelError(string.Empty, "帳號或密碼不正確");
            ViewData["ReturnUrl"] = returnUrl;
            return View(input);
        }

        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return LocalRedirect(returnUrl);
        }

        return RedirectToAction("Index", "Home", new { area = "" });
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return RedirectToAction(nameof(Login));
    }
}
```

`SignInManager` 會驗證密碼雜湊並建立登入 Cookie。程式不需要也不應該自己比較 `PasswordHash`

`returnUrl` 只能在 `Url.IsLocalUrl()` 通過後使用，避免登入後被導向外部網址

## Login View

`Areas/User/Views/Account/Login.cshtml`

```cshtml
@model QMAH.Web.Areas.User.ViewModels.LoginViewModel

@{ ViewData["Title"] = "後台登入"; }

<div class="row justify-content-center">
    <div class="col-md-6 col-lg-4">
        <h1 class="h3 mb-4">後台登入</h1>

        <form asp-action="Login"
              asp-route-returnUrl="@ViewData["ReturnUrl"]"
              method="post">
            <div asp-validation-summary="ModelOnly" class="text-danger mb-3"></div>

            <div class="mb-3">
                <label asp-for="Email" class="form-label"></label>
                <input asp-for="Email" class="form-control" autocomplete="username" />
                <span asp-validation-for="Email" class="text-danger"></span>
            </div>

            <div class="mb-3">
                <label asp-for="Password" class="form-label"></label>
                <input asp-for="Password" class="form-control" autocomplete="current-password" />
                <span asp-validation-for="Password" class="text-danger"></span>
            </div>

            <div class="form-check mb-3">
                <input asp-for="RememberMe" class="form-check-input" />
                <label asp-for="RememberMe" class="form-check-label"></label>
            </div>

            <button type="submit" class="btn btn-primary w-100">登入</button>
        </form>
    </div>
</div>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

## 保護後台 Controller

所有登入者都能進入：

```csharp
[Authorize]
[Area("Social")]
public class SocialPostsController : Controller
```

只有管理員能進入：

```csharp
[Authorize(Roles = "Admin")]
[Area("Social")]
public class ContentReportsController : Controller
```

期中先使用 `Admin` 與 `User` 就夠。不要為每個 Area 建立一個角色，除非團隊真的要展示不同管理員權限。只在 View 隱藏按鈕不算授權，Controller 仍要使用 `[Authorize]`

## 取得目前登入者

需要完整帳號資料時，注入 `UserManager<ApplicationUser>`：

```csharp
private readonly UserManager<ApplicationUser> _userManager;

public ProfilesController(UserManager<ApplicationUser> userManager)
{
    _userManager = userManager;
}

public async Task<IActionResult> MyProfile()
{
    var user = await _userManager.GetUserAsync(User);
    if (user is null)
    {
        return Challenge();
    }

    var userId = user.Id;
    // 使用 userId 查詢 UserProfiles、UserAddresses 或其他 QMAH 資料
    return View();
}
```

不要讓表單自行決定「目前使用者」的 UserId，也不要用 Email、暱稱或畫面文字當外鍵

## 會員 CRUD 的期中範圍

- 帳號清單：使用 `_userManager.Users.AsNoTracking()` 查詢 Email 與鎖定狀態
- Profile 詳情與編輯：使用 `_db.UserProfiles`
- 地址 CRUD：使用 `_db.UserAddresses`
- 角色顯示：使用 `_userManager.GetRolesAsync(user)`
- 帳號停用：需要時使用 Identity lockout API，不直接刪除帳號

期中不做「建立密碼雜湊」「直接編輯角色關聯表」「顯示 PasswordHash」等功能

## 完成後測試

1. 未登入開啟受保護頁面，會導向 Login
2. 錯誤密碼會顯示錯誤且不登入
3. `admin@qmah.local` 可進入 Admin 後台
4. `User` 無法進入 `[Authorize(Roles = "Admin")]` 頁面
5. 登出使用 POST，登出後不能回到受保護頁面
6. `returnUrl` 只接受站內網址

第三方登入留到期末，請看[第三方登入預留方式](external-login.md)
