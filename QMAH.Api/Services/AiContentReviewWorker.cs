using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

using QMAH.Api.Infrastructure.Media;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Services;

// integration: 比照 GameRoomLifecycleWorker，每個 tick 開新的 scope 避免 singleton 背景服務持有
// scoped DbContext。AI 審查刻意放在背景排程而不是發文/留言的同步路徑上：外部 API 呼叫的延遲跟
// 失敗風險都不該卡住使用者發文，洗版當下系統壓力最大時更不該讓使用者等 AI 回應。
// 只處理「規則沒抓到但看起來可疑」的文字（SocialController 用 SuspiciousContentHeuristics 篩過，
// 只有這種內容才會留下 AiReviewedAt = null）跟全部圖片（暴力／色情沒有現成規則可以先篩，只能靠 AI）。
public sealed class AiContentReviewWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<MediaStorageOptions> storageOptions,
    ILogger<AiContentReviewWorker> logger) : BackgroundService
{
    private const int BatchSize = 20;

    // 結果標示 AutoHide（Azure 仇恨類中度以上、其他類別最高級）或 OpenAI 分數 0.95 以上才自動隱藏並送檢舉，
    // 其餘只送檢舉待審，避免誤判太多造成管理壓力，也避免正常內容被擋掉。管理員可在後台還原。
    private const double AutoHideScore = 0.95;

    // 金鑰缺少（例如經費還在申請）時只在第一次警告一次，避免排程每 10 秒洗一次 log；
    // 一旦偵測到又恢復未設定狀態（理論上不會發生，但保留彈性）會重新警告一次。
    private bool _hasWarnedNotConfigured;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        try
        {
            do
            {
                try
                {
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
                    var aiReview = scope.ServiceProvider.GetRequiredService<IAiContentReviewService>();

                    if (!aiReview.IsConfigured)
                    {
                        // 沒有設定 API Key（例如經費申請中）：整批跳過，不去動 AiReviewedAt。
                        // 這樣等金鑰設定好之後，這段空窗期累積的貼文/留言/圖片會在下一輪排程
                        // 自動被抓出來補審查，不會因為先前被誤標成「已審查」而永久漏審。
                        if (!_hasWarnedNotConfigured)
                        {
                            logger.LogWarning("OpenAi:ApiKey 尚未設定，AI 內容審查排程本次略過，將持續等待設定完成後自動補審查累積內容。");
                            _hasWarnedNotConfigured = true;
                        }
                        continue;
                    }
                    _hasWarnedNotConfigured = false;

                    await ReviewPostsAsync(db, aiReview, stoppingToken);
                    await ReviewCommentsAsync(db, aiReview, stoppingToken);
                    await ReviewMediaAsync(db, aiReview, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    logger.LogError(exception, "AI 內容審查排程發生錯誤。");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // 停止服務會取消計時器等待，屬於正常結束，不應回報背景服務故障。
        }
    }

    private async Task ReviewPostsAsync(QmahDbContext db, IAiContentReviewService aiReview, CancellationToken cancellationToken)
    {
        var posts = await db.SocialPosts
            .Where(post => post.AiReviewedAt == null && post.Status == "PUBLISHED")
            .OrderBy(post => post.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var post in posts)
        {
            var now = DateTime.UtcNow;
            AiReviewResult result;
            try
            {
                result = await aiReview.ReviewTextAsync($"{post.Title}\n{post.Content}", cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (HttpRequestException exception) when (exception.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.TooManyRequests)
            {
                // 金鑰失效或額度／頻率用完：整批停下等下一輪，內容保持待審，不逐筆重打。
                logger.LogWarning("AI 內容審查被拒絕（{StatusCode}），本輪停止，內容保持待審。", (int)exception.StatusCode!.Value);
                return;
            }
            catch (Exception exception)
            {
                // 呼叫失敗就先跳過這篇，AiReviewedAt 保持 null，下一輪排程會重試，不會漏審。
                logger.LogError(exception, "AI 文字審查貼文 {PostId} 失敗，留待下次排程重試。", post.Id);
                continue;
            }

            if (result.Flagged)
            {
                var hide = result.AutoHide || result.Score >= AutoHideScore;
                db.ContentReports.Add(CreateAiReport("POST", post.Id, now, result, autoHidden: hide));
                if (hide)
                {
                    post.Status = "HIDDEN";
                    post.UpdatedAt = now;
                }
            }
            post.AiReviewedAt = now;
        }

        if (posts.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
    }

    private async Task ReviewCommentsAsync(QmahDbContext db, IAiContentReviewService aiReview, CancellationToken cancellationToken)
    {
        var comments = await db.SocialComments
            .Where(comment => comment.AiReviewedAt == null && comment.Status == "PUBLISHED")
            .OrderBy(comment => comment.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var comment in comments)
        {
            var now = DateTime.UtcNow;
            AiReviewResult result;
            try
            {
                result = await aiReview.ReviewTextAsync(comment.Content, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (HttpRequestException exception) when (exception.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.TooManyRequests)
            {
                // 金鑰失效或額度／頻率用完：整批停下等下一輪，內容保持待審，不逐筆重打。
                logger.LogWarning("AI 內容審查被拒絕（{StatusCode}），本輪停止，內容保持待審。", (int)exception.StatusCode!.Value);
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "AI 文字審查留言 {CommentId} 失敗，留待下次排程重試。", comment.Id);
                continue;
            }

            if (result.Flagged)
            {
                var hide = result.AutoHide || result.Score >= AutoHideScore;
                db.ContentReports.Add(CreateAiReport("COMMENT", comment.Id, now, result, autoHidden: hide));
                if (hide)
                {
                    comment.Status = "HIDDEN";
                    comment.UpdatedAt = now;
                }
            }
            comment.AiReviewedAt = now;
        }

        if (comments.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
    }

    private async Task ReviewMediaAsync(QmahDbContext db, IAiContentReviewService aiReview, CancellationToken cancellationToken)
    {
        // 只審已經綁定貼文（PostId 不是 null）的圖片：還沒附加到貼文的暫存圖片就算違規，
        // 使用者自己刪掉或換掉也不會真的公開出去，等真的發布出去才審查比較不浪費 API 呼叫。
        var mediaAssets = await db.MediaAssets
            .Where(media => media.AiReviewedAt == null && media.PostId != null && media.Status == "ACTIVE")
            .OrderBy(media => media.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var media in mediaAssets)
        {
            var now = DateTime.UtcNow;
            try
            {
                var physicalPath = ResolvePhysicalPath(media.StoredPath);
                if (File.Exists(physicalPath))
                {
                    var bytes = await File.ReadAllBytesAsync(physicalPath, cancellationToken);
                    var result = await aiReview.ReviewImageAsync(bytes, media.ContentType, cancellationToken);
                    if (result.Flagged && media.PostId.HasValue)
                    {
                        var hide = result.AutoHide || result.Score >= AutoHideScore;
                        db.ContentReports.Add(CreateAiReport("POST", media.PostId.Value, now, result, isImage: true, autoHidden: hide));
                        if (hide)
                        {
                            var post = await db.SocialPosts.FirstOrDefaultAsync(item => item.Id == media.PostId.Value, cancellationToken);
                            if (post is { Status: "PUBLISHED" })
                            {
                                post.Status = "HIDDEN";
                                post.UpdatedAt = now;
                            }
                        }
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (HttpRequestException exception) when (exception.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.TooManyRequests)
            {
                // 金鑰失效或額度／頻率用完：整批停下等下一輪，內容保持待審，不逐筆重打。
                logger.LogWarning("AI 內容審查被拒絕（{StatusCode}），本輪停止，內容保持待審。", (int)exception.StatusCode!.Value);
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "AI 圖片審查 {MediaId} 失敗，留待下次排程重試。", media.Id);
                continue;
            }
            media.AiReviewedAt = now;
        }

        if (mediaAssets.Count > 0)
            await db.SaveChangesAsync(cancellationToken);
    }

    private string ResolvePhysicalPath(string relativePath) =>
        Path.GetFullPath(Path.Combine(Path.GetFullPath(storageOptions.Value.RootPath), relativePath));

    // Reason 固定用 AUTO_AI，跟關鍵字表／SimHash 送出的 AUTO_KEYWORD、AUTO_DUPLICATE（見
    // SocialController.CreateAutoReport）分開，後台檢舉列表一眼就能看出這筆是 AI 判斷還是規則命中。
    private static ContentReport CreateAiReport(string targetType, Guid targetId, DateTime now, AiReviewResult result, bool isImage = false, bool autoHidden = false)
    {
        var subject = isImage ? "貼文中的圖片" : "內容";
        return new ContentReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = null,
            TargetType = targetType,
            TargetId = targetId,
            Reason = "AUTO_AI",
            Detail = $"系統 AI 審查判定{subject}可能違規（分類：{result.Category ?? "未分類"}，信心值 {result.Score:0.00}）。{(autoHidden ? "已先自動隱藏，請管理員確認後決定還原或維持。" : string.Empty)}",
            IsAutoGenerated = true,
            Status = "PENDING",
            CreatedAt = now
        };
    }
}
