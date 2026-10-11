using System.Text;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using QMAH.Api.Controllers.V1;
using QMAH.Api.Infrastructure.Identity;
using QMAH.Infrastructure.Configuration;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Identity;
using SignInResult = Microsoft.AspNetCore.Identity.SignInResult;

// 使用真正的 Identity token provider；所有會員讀寫由測試 manager 留在記憶體，不連資料庫或寄真信。
var services = new ServiceCollection();
services.AddLogging();
services.AddControllers();
services.AddDataProtection().UseEphemeralDataProtectionProvider();
services.AddIdentityCore<ApplicationUser>().AddDefaultTokenProviders();
using var provider = services.BuildServiceProvider();
await using var db = new TestDbContext(new DbContextOptionsBuilder<QmahDbContext>()
    .UseSqlServer("Server=unused;Database=unused;Integrated Security=true").Options);
using var users = new TestUserManager(db, provider);
var member = new ApplicationUser { Id = Guid.NewGuid(), Email = "member@example.com", SecurityStamp = Guid.NewGuid().ToString(), Status = "ACTIVE" };
users.Member = member;
var sender = new CapturingSender();
var signIn = new TestSignInManager(users, provider.GetRequiredService<IOptions<IdentityOptions>>());
var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Frontend:ClientUrl"] = "https://qmah.example" }).Build();
var controller = new AccountController(users, signIn, db, sender,
    Options.Create(new QmahPasswordResetOptions()),
    configuration,
    null!, NullLogger<AccountController>.Instance)
{
    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { RequestServices = provider } }
};

var unverifiedLogin = await controller.Login(new LoginRequest { Email = member.Email!, Password = "correct" });
Check(unverifiedLogin is ObjectResult { StatusCode: 403, Value: ProblemDetails problem }
    && problem.Extensions["code"]?.ToString() == "email_verification_required" && signIn.CookieLogins == 0,
    "未驗證信箱且密碼正確不能建立 cookie");
signIn.PasswordValid = false;
Check(await controller.Login(new LoginRequest { Email = member.Email!, Password = "wrong" }) is UnauthorizedObjectResult,
    "密碼錯誤不透露信箱驗證狀態");
signIn.PasswordValid = true;

Check(await controller.ResendConfirmation(new ResendConfirmationRequest { Password = "correct", Email = "member@example.com" }) is AcceptedResult, "重寄回傳一致結果");
Check(sender.Url!.StartsWith("https://qmah.example/verify-email?"), "使用部署前台網址建立驗證連結");
var query = QueryHelpers.ParseQuery(new Uri(sender.Url).Query);
var request = new ConfirmEmailRequest { Email = "member@example.com", Token = query["token"].ToString() };
var linkSendCount = sender.Count;
Check(await controller.ResendConfirmationFromLink(request) is AcceptedResult && sender.Count == linkSendCount + 1,
    "原信箱搭配原 token 可以重寄");
var originalPendingMember = users.Member;
users.Member = new ApplicationUser { Id = Guid.NewGuid(), Email = "other@example.com", SecurityStamp = Guid.NewGuid().ToString(), Status = "ACTIVE" };
linkSendCount = sender.Count;
Check(await controller.ResendConfirmationFromLink(new ConfirmEmailRequest { Email = "other@example.com", Token = request.Token }) is ObjectResult { StatusCode: 400 }
    && sender.Count == linkSendCount && !users.Member.EmailConfirmed, "兩個未驗證帳號之間替換 Email 不會寄信也不會驗證");
Check(await controller.ResendConfirmationFromLink(new ConfirmEmailRequest { Email = "other@example.com", Token = "fake" }) is ObjectResult { StatusCode: 400 }
    && sender.Count == linkSendCount, "偽造重寄 token 不寄信");
signIn.PasswordValid = false;
Check(await controller.ResendConfirmation(new ResendConfirmationRequest { Email = "other@example.com", Password = "wrong" }) is AcceptedResult
    && sender.Count == linkSendCount, "刪掉 token 改走一般重寄時密碼錯誤仍不會寄信");
signIn.PasswordValid = true;
users.Member = originalPendingMember;
Check(await controller.ConfirmEmail(request) is NoContentResult && member.EmailConfirmed, "真正的驗證 token 可確認信箱");
Check(await controller.Login(new LoginRequest { Email = member.Email!, Password = "correct" }) is NoContentResult
    && signIn.CookieLogins == 1, "完成驗證後才走登入 cookie 流程");
Check(await controller.ConfirmEmail(request) is NoContentResult, "合法連結重複確認保持成功");
var originalMember = users.Member;
users.Member = new ApplicationUser { Id = Guid.NewGuid(), Email = "other@example.com", SecurityStamp = Guid.NewGuid().ToString(), Status = "ACTIVE" };
Check(await controller.ConfirmEmail(new ConfirmEmailRequest { Email = "other@example.com", Token = request.Token }) is ObjectResult { StatusCode: 400 }
    && !users.Member.EmailConfirmed, "更換 Email 不能用原會員 token 驗證其他帳號");
users.Member = originalMember;
Check(await controller.ConfirmEmail(new ConfirmEmailRequest { Email = member.Email!, Token = "%%%" }) is ObjectResult { StatusCode: 400 }, "已驗證信箱仍拒絕格式錯誤 token");
Check(await controller.ConfirmEmail(new ConfirmEmailRequest { Email = member.Email!, Token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes("fake")) }) is ObjectResult { StatusCode: 400 }, "已驗證信箱仍拒絕偽造 token");
var sentBefore = sender.Count;
await controller.ResendConfirmation(new ResendConfirmationRequest { Password = "correct", Email = member.Email! });
Check(sender.Count == sentBefore, "已驗證會員不重寄");
member.EmailConfirmed = false;
var resetToken = await users.GeneratePasswordResetTokenAsync(member);
Check(await controller.ConfirmEmail(new ConfirmEmailRequest { Email = member.Email!, Token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(resetToken)) }) is ObjectResult { StatusCode: 400 }, "密碼重設 token 不能用來驗證信箱");
member.SecurityStamp = Guid.NewGuid().ToString();
Check(await controller.ConfirmEmail(request) is ObjectResult { StatusCode: 400 }, "security stamp 更新後拒絕舊連結");
var missingResult = await controller.ResendConfirmation(new ResendConfirmationRequest { Password = "correct", Email = "missing@example.com" });
sender.Fail = true;
var failureResult = await controller.ResendConfirmation(new ResendConfirmationRequest { Password = "correct", Email = member.Email! });
Check(missingResult is AcceptedResult missing && failureResult is AcceptedResult failure
    && System.Text.Json.JsonSerializer.Serialize(missing.Value) == System.Text.Json.JsonSerializer.Serialize(failure.Value), "不存在會員與寄信失敗回應相同");
Check(!member.EmailConfirmed, "寄信失敗不會將帳號標記已驗證");
var freshToken = await users.GenerateEmailConfirmationTokenAsync(member);
var tokenOptions = provider.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;
var originalLifetime = tokenOptions.TokenLifespan;
tokenOptions.TokenLifespan = TimeSpan.FromTicks(-1);
var expiredSendCount = sender.Count;
Check(await controller.ResendConfirmationFromLink(new ConfirmEmailRequest { Email = member.Email!,
    Token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(freshToken)) }) is ObjectResult { StatusCode: 400 }
    && sender.Count == expiredSendCount, "過期 token 不能用於重寄");
Check(await controller.ConfirmEmail(new ConfirmEmailRequest { Email = member.Email!,
    Token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(freshToken)) }) is ObjectResult { StatusCode: 400 }, "過期的合法 token 不能驗證信箱");
tokenOptions.TokenLifespan = originalLifetime;
member.Status = "SUSPENDED";
Check(await controller.ConfirmEmail(request) is ObjectResult { StatusCode: 400 }, "停權帳號不能驗證");
Console.WriteLine("信箱驗證檢查全部通過。");

member.Status = "ACTIVE";
member.EmailConfirmed = true;
member.PasswordHash = users.PasswordHasher.HashPassword(member, "Original1!");
signIn.UseRealPasswordCheck = true;
controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([
    new Claim(ClaimTypes.NameIdentifier, member.Id.ToString())], "checks"));
var passwordChange = new ChangePasswordRequest { CurrentPassword = "Wrong1!", NewPassword = "Changed2!", ConfirmPassword = "Changed2!" };
var originalHash = member.PasswordHash;
Check(await controller.ChangePassword(passwordChange) is ObjectResult { StatusCode: 400 }
    && member.PasswordHash == originalHash && signIn.SignOuts == 0, "目前密碼錯誤不會修改密碼或登出");
passwordChange.CurrentPassword = "Original1!";
passwordChange.NewPassword = passwordChange.ConfirmPassword = "Original1!";
Check(await controller.ChangePassword(passwordChange) is ObjectResult { StatusCode: 400 }, "新密碼不可與原密碼相同");
passwordChange.NewPassword = "Changed2!";
passwordChange.ConfirmPassword = "Different3!";
Check(!Validator.TryValidateObject(passwordChange, new ValidationContext(passwordChange), [], true), "DTO 拒絕不一致的確認密碼");
passwordChange.NewPassword = passwordChange.ConfirmPassword = "weak";
Check(!Validator.TryValidateObject(passwordChange, new ValidationContext(passwordChange), [], true), "DTO 拒絕少於八字元的新密碼");
passwordChange.NewPassword = passwordChange.ConfirmPassword = "weakpassword";
var weakResult = await controller.ChangePassword(passwordChange);
Check(weakResult is ObjectResult { Value: ValidationProblemDetails { Status: 400 } }
    && member.PasswordHash == originalHash, "後端 Identity 獨立拒絕不符合強度規則的密碼");
controller.ModelState.Clear();
signIn.SimulateLockout = true;
Check(await controller.ChangePassword(passwordChange) is ObjectResult { StatusCode: 423 }, "修改密碼遵守帳號鎖定");
signIn.SimulateLockout = false;
var originalStamp = member.SecurityStamp;
passwordChange.NewPassword = passwordChange.ConfirmPassword = "Changed2!";
Check(await controller.ChangePassword(passwordChange) is NoContentResult && signIn.SignOuts == 1, "修改成功登出目前 session");
Check(await users.CheckPasswordAsync(member, "Changed2!") && !await users.CheckPasswordAsync(member, "Original1!"), "真實雜湊更新後新密碼可用、舊密碼失效");
Check(member.SecurityStamp != originalStamp, "更新 security stamp 讓既有 cookie 與舊重設 token 失效");
member.PasswordHash = null;
Check(await controller.ChangePassword(passwordChange) is ObjectResult { StatusCode: 409 }, "第三方專用會員不能誤走修改密碼流程");
member.Status = "SUSPENDED";
Check(await controller.ChangePassword(passwordChange) is UnauthorizedResult, "停權會員不能修改密碼");
member.Status = "ACTIVE";
controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
Check(await controller.ChangePassword(passwordChange) is UnauthorizedResult, "未登入請求不能修改密碼");
Console.WriteLine("會員修改密碼檢查全部通過。");

// 首次同 Email 綁定與既有 Provider + ProviderKey 登入使用一致規則。
member.EmailConfirmed = false;
member.Status = "ACTIVE";
member.PasswordHash = users.PasswordHasher.HashPassword(member, "Original1!");
signIn.ExternalInfo = new ExternalLoginInfo(new ClaimsPrincipal(new ClaimsIdentity([
    new Claim(ClaimTypes.Email, member.Email!)], "external")), "Google", "new-google-id", "Google");
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/login?googleError=email_verification_required" }
    && users.AddLoginCalls == 0 && signIn.ExternalLogins == 0,
    "未驗證一般會員不能新增同 Email 第三方綁定");
member.EmailConfirmed = true;
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/member" }
    && users.AddLoginCalls == 1 && users.CreateCalls == 0 && users.LinkedMember?.Id == member.Id,
    "已驗證會員首次同 Email Google 登入綁定原會員，不重複建立會員");
users.LinkedMember = null;
signIn.ExternalInfo = new ExternalLoginInfo(signIn.ExternalInfo.Principal, "Logto", "new-logto-id", "Logto");
Check(await controller.LogtoCallback() is RedirectResult { Url: "https://qmah.example/member" }
    && users.AddLoginCalls == 2 && users.LinkedMember?.Id == member.Id,
    "首次同 Email Logto 登入沿用原會員");
users.LinkedMember = null;
member.PasswordHash = null;
member.EmailConfirmed = false;
Check(await controller.LogtoCallback() is RedirectResult { Url: "https://qmah.example/member" }
    && users.AddLoginCalls == 3 && users.LinkedMember?.Id == member.Id,
    "第三方專用會員依相同 Email 新增綁定");
signIn.ExternalInfo = new ExternalLoginInfo(new ClaimsPrincipal(new ClaimsIdentity([
    new Claim(ClaimTypes.Email, "changed@example.com")], "external")), "Google", "existing-google-id", "Google");
var externalLoginsBefore = signIn.ExternalLogins;
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/member" }
    && signIn.ExternalLogins == externalLoginsBefore + 1 && users.AddLoginCalls == 3,
    "既有綁定依第三方識別碼登入原會員，不受 Email claim 改變影響");
member.Status = "SUSPENDED";
externalLoginsBefore = signIn.ExternalLogins;
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/login?googleError=1" }
    && signIn.ExternalLogins == externalLoginsBefore, "已綁定但停權會員仍不能登入");
member.Status = "ACTIVE";
signIn.ExternalResult = SignInResult.LockedOut;
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/login?googleError=1" }
    && users.AddLoginCalls == 3 && users.CreateCalls == 0,
    "已綁定登入失敗不可轉入新會員或自動綁定流程");
users.LinkedMember = null;
signIn.ExternalResult = SignInResult.Success;
signIn.ExternalInfo = new ExternalLoginInfo(signIn.ExternalInfo.Principal, "Logto", "unexpected-provider", "Logto");
externalLoginsBefore = signIn.ExternalLogins;
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/login?googleError=1" }
    && signIn.ExternalLogins == externalLoginsBefore && users.CreateCalls == 0,
    "Google callback 拒絕其他 Provider 的外部身分");
signIn.ExternalInfo = new ExternalLoginInfo(signIn.ExternalInfo.Principal, "Google", "brand-new-id", "Google");
Check(await controller.GoogleCallback() is RedirectResult { Url: "https://qmah.example/login?googleError=1" }
    && users.CreateCalls == 1 && users.AddLoginCalls == 3,
    "無同 Email 會員仍進入建立流程，建立失敗時不綁定或登入");
signIn.ExternalInfo = new ExternalLoginInfo(new ClaimsPrincipal(new ClaimsIdentity([
    new Claim(ClaimTypes.Email, member.Email!)], "external")), "Logto", "unlinked-id", "Logto");
member.Status = "SUSPENDED";
Check(await controller.LogtoCallback() is RedirectResult { Url: "https://qmah.example/login?logtoError=1" }
    && users.AddLoginCalls == 3, "停權會員不能新增同 Email 綁定");
member.Status = "ACTIVE";
users.SimulateLockout = true;
Check(await controller.LogtoCallback() is RedirectResult { Url: "https://qmah.example/login?logtoError=1" }
    && users.AddLoginCalls == 3, "鎖定會員不能新增同 Email 綁定");
users.SimulateLockout = false;
users.FailAddLogin = true;
externalLoginsBefore = signIn.ExternalLogins;
Check(await controller.LogtoCallback() is RedirectResult { Url: "https://qmah.example/login?logtoError=1" }
    && users.LinkedMember is null && signIn.ExternalLogins == externalLoginsBefore,
    "綁定失敗不會登入會員");
Console.WriteLine("第三方登入統一綁定規則檢查全部通過。");

static void Check(bool condition, string description)
{
    if (!condition) throw new Exception(description);
    Console.WriteLine($"PASS {description}");
}

sealed class TestUserManager(QmahDbContext db, IServiceProvider services) : UserManager<ApplicationUser>(
    new UserStore<ApplicationUser, IdentityRole<Guid>, QmahDbContext, Guid>(db),
    services.GetRequiredService<IOptions<IdentityOptions>>(), new PasswordHasher<ApplicationUser>(),
    [], [new PasswordValidator<ApplicationUser>()], new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), services, NullLogger<UserManager<ApplicationUser>>.Instance)
{
    public ApplicationUser? Member { get; set; }
    public ApplicationUser? LinkedMember { get; set; }
    public int AddLoginCalls { get; private set; }
    public int CreateCalls { get; private set; }
    public bool FailAddLogin { get; set; }
    public bool SimulateLockout { get; set; }
    public override Task<bool> IsLockedOutAsync(ApplicationUser user) => Task.FromResult(SimulateLockout);
    public override Task<ApplicationUser?> FindByLoginAsync(string loginProvider, string providerKey)
        => Task.FromResult(LinkedMember);
    public override Task<IdentityResult> AddLoginAsync(ApplicationUser user, UserLoginInfo login)
    {
        AddLoginCalls++;
        if (FailAddLogin) return Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "SimulatedLinkFailure" }));
        LinkedMember = user;
        return Task.FromResult(IdentityResult.Success);
    }
    public override Task<IdentityResult> CreateAsync(ApplicationUser user)
    { CreateCalls++; return Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "SimulatedCreateFailure" })); }
    public override Task<ApplicationUser?> FindByEmailAsync(string email)
        => Task.FromResult(string.Equals(Member?.Email, email, StringComparison.OrdinalIgnoreCase) ? Member : null);
    public override Task<ApplicationUser?> FindByIdAsync(string userId)
        => Task.FromResult(Member?.Id.ToString() == userId ? Member : null);
    protected override Task<IdentityResult> UpdateUserAsync(ApplicationUser user) => Task.FromResult(IdentityResult.Success);
}

sealed class TestDbContext(DbContextOptions<QmahDbContext> options) : QmahDbContext(options)
{
    public override DatabaseFacade Database => new TestDatabaseFacade(this);
}

sealed class TestDatabaseFacade(DbContext context) : DatabaseFacade(context)
{
    public override Task<bool> CanConnectAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
}

sealed class TestSignInManager(UserManager<ApplicationUser> users, IOptions<IdentityOptions> options) : SignInManager<ApplicationUser>(
    users, new HttpContextAccessor(), new UserClaimsPrincipalFactory<ApplicationUser>(users, options), options,
    NullLogger<SignInManager<ApplicationUser>>.Instance,
    new AuthenticationSchemeProvider(Microsoft.Extensions.Options.Options.Create(new AuthenticationOptions())), new DefaultUserConfirmation<ApplicationUser>())
{
    public bool PasswordValid { get; set; } = true;
    public int CookieLogins { get; private set; }
    public int SignOuts { get; private set; }
    public bool UseRealPasswordCheck { get; set; }
    public bool SimulateLockout { get; set; }
    public ExternalLoginInfo? ExternalInfo { get; set; }
    public SignInResult ExternalResult { get; set; } = SignInResult.Success;
    public int ExternalLogins { get; private set; }
    public override Task<ExternalLoginInfo?> GetExternalLoginInfoAsync(string? expectedXsrf = null)
        => Task.FromResult(ExternalInfo);
    public override Task<SignInResult> ExternalLoginSignInAsync(string loginProvider, string providerKey, bool isPersistent, bool bypassTwoFactor)
    { ExternalLogins++; return Task.FromResult(ExternalResult); }
    public override async Task<SignInResult> CheckPasswordSignInAsync(ApplicationUser user, string password, bool lockoutOnFailure)
        => SimulateLockout ? SignInResult.LockedOut
            : (UseRealPasswordCheck ? await UserManager.CheckPasswordAsync(user, password) : PasswordValid) ? SignInResult.Success : SignInResult.Failed;
    public override Task SignOutAsync() { SignOuts++; return Task.CompletedTask; }
    public override Task<SignInResult> PasswordSignInAsync(ApplicationUser user, string password, bool isPersistent, bool lockoutOnFailure)
    {
        CookieLogins++;
        return Task.FromResult(SignInResult.Success);
    }
}

sealed class CapturingSender : IPasswordResetEmailSender
{
    public string? Url { get; private set; }
    public int Count { get; private set; }
    public bool Fail { get; set; }
    public Task SendAsync(string email, string url, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task SendConfirmationAsync(string email, string url, CancellationToken cancellationToken = default)
    {
        if (Fail) throw new HttpRequestException("Simulated email outage");
        Url = url;
        Count++;
        return Task.CompletedTask;
    }
}
