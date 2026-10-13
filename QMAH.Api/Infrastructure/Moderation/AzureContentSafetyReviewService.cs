using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Infrastructure.Moderation;

// Azure AI Content Safety（免費層 F0 每月 5,000 筆文字、5,000 張圖片，額度用完即停、不會產生超額費用）。
// 文字與圖片各自一支 REST API，四個分類 Hate／SelfHarm／Sexual／Violence 各回傳 0、2、4、6 的嚴重度。
// 門檻刻意放寬以降低管理壓力：仇恨類嚴重度 2（低度）起送檢舉、4（中度）起先自動隱藏；
// 其他類別 4（中度）才送檢舉、6（最高級）才自動隱藏，低度的玩笑與情緒性字眼不吵管理員。
// 金鑰與端點只從設定讀取（環境變數 ContentSafety__Endpoint／ContentSafety__ApiKey），不進 log。
public sealed class AzureContentSafetyReviewService(
    HttpClient httpClient,
    ILogger<AzureContentSafetyReviewService> logger,
    IConfiguration configuration) : IAiContentReviewService
{
    private const string ApiVersion = "2024-09-01";
    private const int FlagSeverity = 4;
    private const int HateFlagSeverity = 2;
    private const int HateHideSeverity = 4;
    private const int HideSeverity = 6;
    private const int MaxTextLength = 10_000;
    private const int MaxImageBytes = 4 * 1024 * 1024;
    private static readonly string[] Categories = ["Hate", "SelfHarm", "Sexual", "Violence"];

    private string? Endpoint => configuration["ContentSafety:Endpoint"]?.TrimEnd('/');
    private string? ApiKey => configuration["ContentSafety:ApiKey"];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Endpoint) && !string.IsNullOrWhiteSpace(ApiKey);

    public string ProviderName => "Azure AI Content Safety";

    public Task<AiReviewResult> ReviewTextAsync(string content, CancellationToken cancellationToken = default)
    {
        var text = content.Length <= MaxTextLength ? content : content[..MaxTextLength];
        return SendAsync("text:analyze", new JsonObject { ["text"] = text }, cancellationToken);
    }

    public Task<AiReviewResult> ReviewImageAsync(byte[] imageBytes, string contentType, CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length > MaxImageBytes)
        {
            logger.LogWarning("圖片超過 Azure Content Safety 的 4 MB 上限，略過 AI 審查。");
            return Task.FromResult(new AiReviewResult(false, null, null, null));
        }
        return SendAsync("image:analyze",
            new JsonObject { ["image"] = new JsonObject { ["content"] = Convert.ToBase64String(imageBytes) } },
            cancellationToken);
    }

    private async Task<AiReviewResult> SendAsync(string operation, JsonObject body, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("ContentSafety:Endpoint 或 ContentSafety:ApiKey 尚未設定。");

        body["categories"] = new JsonArray(Categories.Select(category => (JsonNode)JsonValue.Create(category)!).ToArray());
        body["outputType"] = "FourSeverityLevels";

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{Endpoint}/contentsafety/{operation}?api-version={ApiVersion}")
        {
            Content = JsonContent.Create(body)
        };
        request.Headers.Add("Ocp-Apim-Subscription-Key", ApiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Azure Content Safety 呼叫失敗。StatusCode={StatusCode} Response={Response}",
                (int)response.StatusCode, responseBody.Length <= 1000 ? responseBody : responseBody[..1000]);
            // 400 類是這筆內容本身無法審查（格式不支援、太小等），重試也不會成功，視為沒有命中。
            // 其餘（金鑰、限流、服務暫時異常）要保持待審、下一輪重試，不能當成「審查過沒問題」。
            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge or HttpStatusCode.UnprocessableEntity)
                return new AiReviewResult(false, null, null, null);
            throw new HttpRequestException($"Azure Content Safety 回應 {(int)response.StatusCode}。", null, response.StatusCode);
        }

        using var document = JsonDocument.Parse(responseBody);
        string? topCategory = null;
        var topSeverity = 0;
        var hide = false;
        foreach (var item in document.RootElement.GetProperty("categoriesAnalysis").EnumerateArray())
        {
            var severity = item.TryGetProperty("severity", out var severityElement) ? severityElement.GetInt32() : 0;
            var category = item.GetProperty("category").GetString()?.ToLowerInvariant();
            var isHate = category == "hate";
            if (severity < (isHate ? HateFlagSeverity : FlagSeverity))
                continue;

            hide |= severity >= (isHate ? HateHideSeverity : HideSeverity);
            if (severity > topSeverity)
            {
                topSeverity = severity;
                topCategory = category;
            }
        }

        if (topCategory is null)
            return new AiReviewResult(false, null, null, null);

        var score = topSeverity / 6d;
        return new AiReviewResult(true, topCategory, score, $"AI 判定命中分類「{topCategory}」，信心值 {score:0.00}。", hide);
    }
}
