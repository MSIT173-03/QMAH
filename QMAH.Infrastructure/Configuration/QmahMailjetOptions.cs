namespace QMAH.Infrastructure.Configuration;

/// <summary>
/// Mailjet Send API 設定。API Key 與 Secret Key 應由 User Secrets、環境變數或部署平台的 secret 注入。
/// </summary>
public sealed class QmahMailjetOptions
{
    public const string SectionName = "Mailjet";

    public string ApiKey { get; set; } = "";

    public string SecretKey { get; set; } = "";

    public string FromEmail { get; set; } = "";

    public string FromName { get; set; } = "清明鑑定屋";

    public string PasswordResetSubject { get; set; } = "重設清明鑑定屋會員密碼";
}
