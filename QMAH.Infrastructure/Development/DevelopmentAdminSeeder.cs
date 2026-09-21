using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using QMAH.Infrastructure.Models.Identity;

namespace QMAH.Infrastructure.Development;

/// <summary>API 與 Web 共用的 Development 展示帳號密碼初始化。</summary>
public static class DevelopmentAdminSeeder
{
    public static async Task ResetDevelopmentPasswordsAsync(
        IServiceProvider services,
        IConfiguration configuration)
    {
        using var scope = services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await ResetPasswordAsync(userManager, configuration["DevelopmentAdmin:Email"], configuration["DevelopmentAdmin:Password"]);
        await ResetPasswordAsync(userManager, configuration["DevelopmentUser:Email"], configuration["DevelopmentUser:Password"]);
    }

    private static async Task ResetPasswordAsync(
        UserManager<ApplicationUser> userManager,
        string? email,
        string? password)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return;

        var user = await userManager.FindByEmailAsync(email);
        if (user is null || await userManager.CheckPasswordAsync(user, password))
            return;

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(error => error.Description));
            throw new InvalidOperationException($"開發用帳號密碼設定失敗：{errors}");
        }
    }
}
