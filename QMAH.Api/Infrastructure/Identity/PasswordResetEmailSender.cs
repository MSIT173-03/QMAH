using System.Net;
using System.Net.Http.Json;

namespace QMAH.Api.Infrastructure.Identity;

public interface IPasswordResetEmailSender
{
    Task SendAsync(
        string email,
        string resetUrl,
        CancellationToken cancellationToken = default);
}

public sealed class PasswordResetEmailSender(
    HttpClient httpClient,
    ILogger<PasswordResetEmailSender> logger,
    IConfiguration configuration) : IPasswordResetEmailSender
{
    public async Task SendAsync(
        string email,
        string resetUrl,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var apiKey = configuration["Brevo:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogError("Brevo:ApiKey 尚未設定。");

            throw new InvalidOperationException(
                "Brevo API Key 尚未設定。");
        }

        await SendViaBrevoAsync(
            email,
            resetUrl,
            apiKey,
            cancellationToken);
    }

    private async Task SendViaBrevoAsync(
        string email,
        string resetUrl,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var encodedResetUrl = WebUtility.HtmlEncode(resetUrl);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "https://api.brevo.com/v3/smtp/email")
        {
            Content = JsonContent.Create(new
            {
                sender = new
                {
                    name = "清明鑑定屋",

                    // 必須與 Brevo 後台已 Verified 的 Sender Email 相同
                    email = "kac1897577@gmail.com"
                },

                to = new[]
                {
                    new
                    {
                        email
                    }
                },

                subject = "清明鑑定屋｜重設密碼",

                textContent = $"""
                    您好，

                    我們收到重設清明鑑定屋會員密碼的請求。

                    請開啟以下連結設定新密碼：

                    {resetUrl}

                    如果不是您提出的請求，請忽略這封信。
                    """,

                htmlContent = $"""
                    <!DOCTYPE html>
                    <html lang="zh-Hant">
                    <body>
                        <h2>清明鑑定屋</h2>

                        <p>您好，</p>

                        <p>
                            我們收到重設清明鑑定屋會員密碼的請求。
                        </p>

                        <p>
                            <a href="{encodedResetUrl}">
                                點此設定新密碼
                            </a>
                        </p>

                        <p>
                            如果按鈕無法使用，也可以複製以下網址到瀏覽器：
                        </p>

                        <p>
                            {encodedResetUrl}
                        </p>

                        <p>
                            如果不是您提出的請求，請忽略這封信。
                        </p>
                    </body>
                    </html>
                    """
            })
        };

        request.Headers.Add("api-key", apiKey);

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        var responseBody =
            await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError(
                "Brevo 密碼重設郵件傳送失敗。StatusCode={StatusCode} Response={Response}",
                (int)response.StatusCode,
                Truncate(responseBody));

            throw new InvalidOperationException(
                "Brevo 密碼重設郵件傳送失敗。");
        }

        logger.LogInformation(
            "密碼重設郵件已交由 Brevo 處理。RecipientDomain={RecipientDomain}",
            GetDomain(email));
    }

    private static string GetDomain(string email)
    {
        var at = email.LastIndexOf('@');

        return at > 0 && at < email.Length - 1
            ? email[(at + 1)..]
            : "unknown";
    }

    private static string Truncate(string value)
    {
        return value.Length <= 1000
            ? value
            : value[..1000];
    }
}