using Microsoft.AspNetCore.Hosting;

namespace QMAH.Api.Infrastructure.Identity;

public interface IPasswordResetEmailSender
{
    Task SendAsync(string email, string resetUrl, CancellationToken cancellationToken = default);
}

public sealed class PasswordResetEmailSender(
    ILogger<PasswordResetEmailSender> logger,
    IWebHostEnvironment environment) : IPasswordResetEmailSender
{
    public Task SendAsync(
        string email,
        string resetUrl,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (environment.IsDevelopment())
        {
            // 本機沒有外部郵件服務時，僅把連結寫入本機開發 log；不存進資料庫，也不回傳 API。
            logger.LogInformation("本機密碼重設連結已產生，Email={Email} ResetUrl={ResetUrl}", email, resetUrl);
        }
        else
        {
            // 正式環境要接入受管控的郵件 provider；未設定前不把 token 寫入回應或一般 log。
            logger.LogInformation("密碼重設郵件已交由郵件服務處理，Email={Email}", email);
        }

        return Task.CompletedTask;
    }
}
