using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Infrastructure.Moderation;

// integration: 文字跟圖片都打 OpenAI Moderation 的 omni-moderation-latest。這個模型本身就同時支援
// 文字與圖片輸入，也會回傳 violence／sexual 這些分類的命中與分數，所以不用另外自己寫一套
// GPT-4o vision 的 prompt 來問「這張圖是不是暴力/色情」——moderation 端點就是為了這個用途設計的，
// 判斷標準由 OpenAI 維護更新，比自己寫 prompt 更省事也更好驗證。
// 比照 PasswordResetEmailSender：typed HttpClient 呼叫外部服務，API Key 只從設定讀取
// （User Secrets／環境變數／部署平台注入），不進一般 log。
public sealed class OpenAiContentReviewService(
    HttpClient httpClient,
    ILogger<OpenAiContentReviewService> logger,
    IConfiguration configuration) : IAiContentReviewService
{
    private const string ModerationEndpoint = "https://api.openai.com/v1/moderations";
    private const string Model = "omni-moderation-latest";

    // 給 AiContentReviewWorker 在排程一開始就檢查，金鑰還沒設定（例如經費申請中）就整批跳過，
    // 不要每篇內容都各自打一次「金鑰缺少」的失敗回應，也不要把內容誤標成已審查。
    public bool IsConfigured => !string.IsNullOrWhiteSpace(configuration["OpenAi:ApiKey"]);

    public Task<AiReviewResult> ReviewTextAsync(string content, CancellationToken cancellationToken = default) =>
        SendAsync(JsonValue.Create(content)!, cancellationToken);

    public Task<AiReviewResult> ReviewImageAsync(byte[] imageBytes, string contentType, CancellationToken cancellationToken = default)
    {
        var dataUrl = $"data:{contentType};base64,{Convert.ToBase64String(imageBytes)}";
        var input = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject { ["url"] = dataUrl }
            }
        };
        return SendAsync(input, cancellationToken);
    }

    private async Task<AiReviewResult> SendAsync(JsonNode input, CancellationToken cancellationToken)
    {
        var apiKey = configuration["OpenAi:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogError("OpenAi:ApiKey 尚未設定，AI 內容審查已略過本次呼叫。");
            return new AiReviewResult(false, null, null, null);
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, ModerationEndpoint)
        {
            Content = JsonContent.Create(new JsonObject
            {
                ["model"] = Model,
                ["input"] = input
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError(
                "OpenAI Moderation 呼叫失敗。StatusCode={StatusCode} Response={Response}",
                (int)response.StatusCode,
                Truncate(body));
            // 呼叫失敗不代表內容有問題，寧可略過這次、留給下一輪排程重試，也不要誤判成違規。
            return new AiReviewResult(false, null, null, null);
        }

        using var document = JsonDocument.Parse(body);
        var result = document.RootElement.GetProperty("results")[0];
        var flagged = result.TryGetProperty("flagged", out var flaggedElement) && flaggedElement.GetBoolean();
        if (!flagged)
            return new AiReviewResult(false, null, null, null);

        string? topCategory = null;
        var topScore = 0d;
        if (result.TryGetProperty("categories", out var categories) && result.TryGetProperty("category_scores", out var scores))
        {
            foreach (var category in categories.EnumerateObject())
            {
                if (category.Value.ValueKind != JsonValueKind.True)
                    continue;
                if (!scores.TryGetProperty(category.Name, out var scoreElement))
                    continue;

                var score = scoreElement.GetDouble();
                if (score > topScore)
                {
                    topScore = score;
                    topCategory = category.Name;
                }
            }
        }

        var summary = $"AI 判定命中分類「{topCategory ?? "未分類"}」，信心值 {topScore:0.00}。";
        return new AiReviewResult(true, topCategory, topScore, summary);
    }

    private static string Truncate(string value) => value.Length <= 1000 ? value : value[..1000];
}
