using System.Data;

using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Social;

/// <summary>
/// 建立或取得單件文物的社群討論串，並把會員的第一則留言與討論串一起保存。
/// </summary>
public sealed class ArtifactDiscussionService(
    QmahDbContext db,
    INotificationService notificationService)
{
    /// <summary>
    /// 確保文物有一篇可見的一般討論貼文，並新增目前會員提供的第一則留言。
    /// </summary>
    public async Task<ArtifactDiscussionResult?> EnsureAsync(
        Guid artifactId,
        Guid userId,
        string initialComment,
        CancellationToken cancellationToken = default)
    {
        var content = initialComment.Trim();

        // Serializable 讓「先查詢、沒有才建立」在同一件文物上取得範圍鎖，
        // 避免兩位會員同時點擊時各自建立兩篇自動討論串；既有一般貼文仍可保留多篇，
        // 只有這個「自動建立」入口需要保證一次只產生一篇可見的 canonical thread。
        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var artifact = await db.Artifacts
            .AsNoTracking()
            .Where(item => item.Id == artifactId && item.IsActive)
            .Select(item => new { item.Id, item.Name })
            .SingleOrDefaultAsync(cancellationToken);

        if (artifact is null)
            return null;

        var post = await db.SocialPosts
            .Where(item => item.ArtifactId == artifactId
                && item.PostType == "POST"
                && item.Status == "PUBLISHED")
            .OrderBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var created = false;
        var now = DateTime.UtcNow;
        if (post is null)
        {
            post = new SocialPost
            {
                Id = Guid.NewGuid(),
                BoardCode = "CATALOG",
                UserId = userId,
                ArtifactId = artifact.Id,
                PostType = "POST",
                PublisherType = "COMMUNITY",
                // 自動建立的外框內容跟著文物名稱產生；會員真正輸入的內容會保留在第一則留言。
                ContentMode = "TEMPLATE",
                Title = BuildTitle(artifact.Name),
                Content = $"這是「{artifact.Name}」的文物討論串，歡迎分享觀察、鑑賞與提問。",
                Status = "PUBLISHED",
                CreatedAt = now,
                UpdatedAt = now
            };
            db.SocialPosts.Add(post);
            created = true;
        }

        var comment = new SocialComment
        {
            Id = Guid.NewGuid(),
            PostId = post.Id,
            UserId = userId,
            Content = content,
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        };
        db.SocialComments.Add(comment);

        // 沿用既有站內通知；建立者自己不需要收到自己的留言通知。
        if (post.UserId != userId)
        {
            notificationService.QueueNotification(
                post.UserId,
                "文物討論有新留言",
                $"文物討論「{post.Title}」有新的留言：{Truncate(content, 60)}",
                $"/social/posts/{post.Id}");
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ArtifactDiscussionResult(post.Id, created, comment.Id);
    }

    private static string BuildTitle(string artifactName)
    {
        const string suffix = "｜文物討論";
        var name = artifactName.Trim();
        return name.Length + suffix.Length <= 150
            ? name + suffix
            : name[..Math.Max(1, 150 - suffix.Length)] + suffix;
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength] + "…";
}

public sealed record ArtifactDiscussionResult(
    Guid PostId,
    bool Created,
    Guid CommentId);
