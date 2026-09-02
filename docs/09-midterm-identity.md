# Identity 與會員資料管理

QMAH 以五個 Area 的 CRUD 後台為主，並已預留獨立 API 使用相同的 Identity 資料。Identity 負責登入身分、後台存取權限，以及程式取得目前使用者的標準方式。

## 目前專題製作範圍

- 各 Area 完成所屬後台 CRUD
- 會員管理可查看帳號，並新增、查詢、修改與刪除 `UserProfiles`、`UserAddresses` 等會員業務資料
- Email、鎖定狀態與角色等 Identity 資料透過 `UserManager`、`RoleManager` 操作
- 後台需要授權時，Controller 可取得目前登入者的 `UserId`
- API 使用相同的 Identity 資料與授權規則，但使用獨立的 Cookie，並以 HTTP 401／403 回應，不將登入頁 HTML 當成 JSON 回傳

共用後台的登入頁、登出按鈕、Cookie 設定與 `Admin` 授權已集中在 Web 主機設定與 User Area。各 Area 不建立各自的登入流程；Controller 與 View 不得假設任意 `UserId`，也不得直接修改 Identity 系統表。API 已提供註冊、登入、登出與開發環境密碼重設流程；正式寄信服務仍要在決定供應商後接上，不能把展示用寄信實作當成正式通知服務。

目前兩個主機都使用 Identity lockout：連續 5 次登入失敗會鎖定 15 分鐘；登入端點另外依來源 IP 進行每分鐘 12 次的固定視窗限流。管理員停用會員時會更新 Security Stamp，讓既有登入 Cookie 在下一次 request 失效。這些規則由主機共用設定維護，Angular 前端使用者前台只需要正確處理 401、403 與 429。

Web 登入 Cookie 名稱為 `.QMAH.Web.Auth`，API 登入 Cookie 名稱為 `.QMAH.Api.Auth`；兩個主機的 Anti-forgery Cookie 也各自使用 `.QMAH.Web.Antiforgery` 與 `.QMAH.Api.Antiforgery`。主機啟動後會清除已知的舊版 QMAH／ASP.NET Core Cookie，降低在本機切換版本時累積過大 request header 的機會；這是 Cookie 清理機制，不代表可以無限制放大伺服器的標頭上限。

## 帳號資料分成兩種

| 資料 | 怎麼操作 | 例子 |
| --- | --- | --- |
| 登入憑證與角色 | `UserManager`、`SignInManager`、`RoleManager` | Email、密碼、鎖定、角色 |
| QMAH 會員資料 | `QmahDbContext` | 暱稱、簡介、地址、通知、成就 |

`AspNetUserLogins` 與 `AspNetUserTokens` 的用途、複合主鍵與 Entity 類型由 ASP.NET Core Identity 定義；schema 名稱與欄位長度可依資料庫設定。QMAH 將 `LoginProvider`、`ProviderKey` 與 Token `Name` 設為 `nvarchar(128)`，並在 `Program.cs` 設定 `options.Stores.MaxLengthForKeys = 128`。這是 Identity 官方模型用來避免複合主鍵超過資料庫索引長度的設定，不是任意縮短登入資料。

欄位對照可以依 SQL Server 調整，但 Identity 的主鍵組合與登入流程不能自行改寫。密碼、角色、Claim、Login 與 Token 仍透過框架 API 操作。

不要用一般 CRUD 直接改 `AspNetUsers.PasswordHash`、`AspNetUserRoles` 或 Token。Identity 還要同步正規化欄位、安全戳記與密碼雜湊，直接改資料表很容易留下無法登入的帳號

`Program.cs` 已完成 Identity DI、角色授權服務、唯一 Email 規則，以及登入、登出與拒絕存取路徑：

- `/Account/Login`
- `/User/Account/Logout`
- `/User/Account/AccessDenied`

最後整合登入頁時不需要再次註冊另一套 Identity，也不需要建立第二個 `DbContext`

## Microsoft 官方參考

以下連結以 ASP.NET Core 10 文件為準：

- [Identity：註冊、登入與登出](https://learn.microsoft.com/zh-tw/aspnet/core/security/authentication/identity?view=aspnetcore-10.0)
- [瀏覽器登入使用 Cookie 的原因](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-api-authorization?view=aspnetcore-10.0)
- [Cookie 驗證與 Data Protection](https://learn.microsoft.com/zh-tw/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0)
- [Data Protection 預設演算法與金鑰設定](https://learn.microsoft.com/zh-tw/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0)
- [Role 與 `[Authorize]` 權限限制](https://learn.microsoft.com/en-us/aspnet/core/mvc/security/authorization/roles?view=aspnetcore-10.0)
- [PasswordHasher 與密碼雜湊](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/consumer-apis/password-hashing?view=aspnetcore-10.0)
- [Identity Scaffolding](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/scaffold-identity?view=aspnetcore-10.0)

Microsoft 建議瀏覽器網站使用 Cookie，因為瀏覽器會自動處理 Cookie，不需要把登入憑證交給 JavaScript。Identity API 的 Token 模式是不能使用 Cookie 的 Client 才考慮的替代方案，該模式產生的 Token 也不是標準 JWT

登入 Cookie 由 ASP.NET Core Data Protection 保護。未自行覆寫設定時，目前文件列出的預設加密演算法是 AES-256-CBC，完整性驗證使用 HMACSHA256，金鑰存留期預設為 90 天。這些是框架預設值，不是資料庫欄位或 QMAH 自訂的加密流程

密碼交給 Identity 的 `PasswordHasher`。不要在 Controller 或 Service 自己呼叫低階 PBKDF2 API，也不要直接讀寫 `PasswordHash`

`AddIdentity<ApplicationUser, IdentityRole<Guid>>()` 已包含目前 QMAH 使用的 Identity 與角色服務。`[Authorize(Roles = "Admin")]` 的角色名稱需要和資料庫中的角色完全一致，`Admin` 與 `admin` 不視為同一個角色

## 不要為 QMAH 另外建立 Identity 專案

QMAH 已經有 `QmahDbContext`、`ApplicationUser`、SQL Server Store 與登入流程。Angular 前端使用者前台可直接沿用這組後端登入契約，不需要另開 MVC 測試專案，也不需要為了驗證登入再建立另一個資料庫、Context 或 Migration。

若只是想閱讀 Microsoft 範本的完整流程，直接參考本節前方的官方 Identity 文件即可。任何外部練習專案都不屬於 QMAH Repository；不要把它的 Context、Migration 或 Identity 類別複製回 QMAH。

## 已存在 QMAH 專案時的 Identity Scaffolding

QMAH 已經有 `QmahDbContext`、`ApplicationUser`、SQL Server Store 與 Identity 套件。若使用 Visual Studio 的 **Add → New Scaffolded Item → Identity**：

1. 使用既有的 `QmahDbContext`，不要建立新的 Context
2. 使用既有的 `ApplicationUser`，不要產生另一個 `IdentityUser`
3. 只選真正需要的頁面，例如 Login、Logout 或 AccessDenied
4. 產生後檢查差異，確認沒有重複註冊 Identity、改動既有 Schema 或加入不需要的 Migration

官方 Identity Scaffolding 通常會產生 Razor Pages。若採用這條路線，必須依產生結果加入 `AddRazorPages()` 與 `MapRazorPages()`；目前 QMAH 採用 MVC `AccountController` 與 View，不要把兩種路由寫法混在同一個登入流程

QMAH 目前已安裝 `Microsoft.AspNetCore.Identity.EntityFrameworkCore`、`Microsoft.EntityFrameworkCore.SqlServer`、`Microsoft.EntityFrameworkCore.Design`、`Microsoft.EntityFrameworkCore.Tools` 與 `Microsoft.VisualStudio.Web.CodeGeneration.Design`。一般開發不需要重複安裝，版本以 `QMAH.Web.csproj` 和 `packages.lock.json` 為準

目前的 MVC `AccountController` 與 View 不需要額外安裝 `Microsoft.AspNetCore.Identity.UI`。若改採官方 Identity Razor Pages Scaffold，才依 Visual Studio 或官方文件提示加入該路線需要的套件，並重新確認 `Program.cs` 的 Razor Pages 註冊

## 參考資料庫帳號

Release 參考資料庫的展示初始化工具會建立 24 個會員與 `Admin`、`User` 兩個角色。展示會員的公開顯示名稱使用 `Demo Admin`、`Demo Member 01`、`Demo Catalog` 等用途名稱，不對應真實人物，也不使用班級成員姓名。以下列出最常用的 8 個情境帳號；完整帳密由工具輸出到 Repository 外，不放進版本控制。

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

`QmahDatabaseRelease seed-showcase-users` 會讀取 Repository 根目錄的 `QMAH.DemoCredentials.local.csv`，並將備份寫到同一位置。根目錄的 `QMAH.DemoCredentials.csv` 是可提交的空白密碼範本；若檔案不存在，或任一展示帳號的 Password 留白，工具會直接停止，不會自動產生密碼。完整帳密不會硬寫在程式碼或資料腳本裡；若網站部署到可由外部連線的環境，仍須先更換所有展示密碼。

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
using QMAH.Infrastructure.Models.Identity;

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

目前使用 `Admin` 與 `User` 就夠。不要為每個 Area 建立一個角色，除非團隊真的要展示不同管理員權限。只在 View 隱藏按鈕不算授權，Controller 仍要使用 `[Authorize]`

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

## 會員 CRUD 範圍

- 帳號清單：使用 `_userManager.Users.AsNoTracking()` 查詢 Email 與鎖定狀態
- Profile 詳情與編輯：使用 `_db.UserProfiles`
- 地址 CRUD：使用 `_db.UserAddresses`
- 角色顯示：使用 `_userManager.GetRolesAsync(user)`
- 帳號停用：使用 Identity lockout API 或既有帳號狀態流程，不直接刪除帳號

不做「建立密碼雜湊」「直接編輯角色關聯表」「顯示 PasswordHash」等功能。API 的註冊與重設密碼同樣必須經過 `UserManager`。

## 完成後測試

1. 未登入開啟受保護頁面，會導向 Login
2. 錯誤密碼會顯示錯誤且不登入
3. `admin@qmah.local` 可進入 Admin 後台
4. `User` 無法進入 `[Authorize(Roles = "Admin")]` 頁面
5. 登出使用 POST，登出後不能回到受保護頁面
6. `returnUrl` 只接受站內網址

第三方登入仍未啟用，資料庫保留標準 Identity 對應即可；確定供應商後再依[第三方登入預留方式](external-login.md)加入。
