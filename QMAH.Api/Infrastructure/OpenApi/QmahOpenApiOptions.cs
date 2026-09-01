namespace QMAH.Api.Infrastructure.OpenApi;

/// <summary>
/// 管理 OpenAPI 與 Scalar 的公開方式
/// </summary>
public sealed class QmahOpenApiOptions
{
    public const string SectionName = "OpenApi";

    /// <summary>
    /// 非開發環境預設停用以避免部署時意外公開契約
    /// 需要公開時可設定 OpenApi__Enabled=true
    /// </summary>
    public bool Enabled { get; set; }

    public bool ScalarEnabled { get; set; }

    public string Title { get; set; } = "QMAH API";

    public string Version { get; set; } = "v1";

    /// <summary>
    /// 產生伺服器清單時使用的可選公開 API 網址
    /// 留空時使用目前請求主機以方便本機開發
    /// </summary>
    public string? ServerUrl { get; set; }
}
