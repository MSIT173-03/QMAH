using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Economy;
using QMAH.Infrastructure.Services.Social;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/social")]
public sealed class SocialController(
    QmahDbContext db,
    CommunityRewardService communityRewardService) : ApiControllerBase
{
    [HttpGet("posts")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiPage<SocialPostListItemDto>>> GetPosts(
        string? q,
        string? boardCode,
        string? postType,
        Guid? artifactId,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.SocialPosts
            .AsNoTracking()
            .Where(post => post.Status == "PUBLISHED");
        q = q?.Trim();
        boardCode = boardCode?.Trim().ToUpperInvariant();
        postType = postType?.Trim().ToUpperInvariant();

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(post =>
                post.Title.Contains(q)
                || post.Content.Contains(q));
        }
        if (!string.IsNullOrWhiteSpace(boardCode))
            query = query.Where(post => post.BoardCode == boardCode);
        if (!string.IsNullOrWhiteSpace(postType))
        {
            if (postType is not ("POST" or "ANNOUNCEMENT" or "EVENT"))
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "貼文類型無效", detail: "貼文類型只能是一般貼文、公告貼文或活動貼文。");
            query = query.Where(post => post.PostType == postType);
        }
        if (artifactId.HasValue)
            query = query.Where(post => post.ArtifactId == artifactId.Value);

        var projected = query
            .OrderByDescending(post => post.CreatedAt)
            .ThenBy(post => post.Id)
            .Select(post => new SocialPostListItemDto(
                post.Id,
                post.BoardCode,
                post.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == post.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                post.ArtifactId,
                post.EventId,
                post.PostType,
                post.PublisherType,
                post.Title,
                post.Content.Length > 180 ? post.Content.Substring(0, 180) : post.Content,
                post.SocialComments.Count(comment => comment.Status == "PUBLISHED"),
                post.MediaAssets.Count(media => media.Status == "ACTIVE"),
                post.LocationName,
                post.Latitude,
                post.Longitude,
                post.CreatedAt,
                post.UpdatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    [HttpGet("posts/{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<SocialPostDetailsDto>> GetPost(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var post = await db.SocialPosts
            .AsNoTracking()
            .Where(item => item.Id == id && item.Status == "PUBLISHED")
            .Select(item => new
            {
                item.Id,
                item.BoardCode,
                item.UserId,
                DisplayName = db.UserProfiles
                    .Where(profile => profile.UserId == item.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                item.ArtifactId,
                item.EventId,
                item.PostType,
                item.PublisherType,
                item.Title,
                item.Content,
                item.LocationName,
                item.Latitude,
                item.Longitude,
                item.CreatedAt,
                item.UpdatedAt
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (post is null)
            return MissingResource("找不到貼文", "這篇貼文不存在或目前不可見。");

        var comments = await db.SocialComments
            .AsNoTracking()
            .Where(comment => comment.PostId == id && comment.Status == "PUBLISHED")
            .OrderBy(comment => comment.CreatedAt)
            .Take(200)
            .Select(comment => new SocialCommentDto(
                comment.Id,
                comment.PostId,
                comment.ParentCommentId,
                comment.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == comment.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                comment.Content,
                comment.CreatedAt,
                comment.UpdatedAt))
            .ToListAsync(cancellationToken);

        var media = await db.MediaAssets
            .AsNoTracking()
            .Where(asset => asset.PostId == id && asset.Status == "ACTIVE")
            .OrderBy(asset => asset.CreatedAt)
            .Select(asset => new
            {
                asset.Id,
                asset.AltText,
                asset.ContentType,
                asset.FileSize,
                asset.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var mediaDtos = media
            .Select(asset => new SocialMediaDto(
                asset.Id,
                BuildMediaUrl(asset.Id),
                asset.AltText,
                asset.ContentType,
                asset.FileSize,
                asset.CreatedAt))
            .ToList();

        return Ok(new SocialPostDetailsDto(
            post.Id,
            post.BoardCode,
            post.UserId,
            post.DisplayName,
            post.ArtifactId,
            post.EventId,
            post.PostType,
            post.PublisherType,
            post.Title,
            post.Content,
            comments,
            mediaDtos,
            post.LocationName,
            post.Latitude,
            post.Longitude,
            post.CreatedAt,
            post.UpdatedAt));
    }

    [HttpGet("events")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiPage<EventListItemDto>>> GetEvents(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.Events
            .AsNoTracking()
            .Where(item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED")
            .OrderBy(item => item.StartAt)
            .Select(item => new EventListItemDto(
                item.Id,
                item.SocialPost == null ? null : item.SocialPost.Id,
                item.EventType,
                item.OrganizerUserId,
                item.Title,
                item.Content,
                item.Location,
                item.Latitude,
                item.Longitude,
                item.StartAt,
                item.EndAt,
                item.RegistrationEndAt,
                item.Capacity,
                item.EventRegistrations.Count(registration =>
                    registration.Status == "REGISTERED" || registration.Status == "ATTENDED")));

        return Ok(await ApiPaging.ToPageAsync(query, page, pageSize, cancellationToken));
    }

    [AllowAnonymous]
    [HttpGet("events/{id:guid}")]
    public async Task<ActionResult<SocialEventDetailsDto>> GetEvent(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var eventData = await db.Events
            .AsNoTracking()
            .Include(item => item.EventRegistrations)
            .Include(item => item.SocialPost)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (eventData is null)
            return MissingResource("找不到活動", "這場活動不存在或目前不可參加。");

        var isOrganizer = TryGetCurrentUserId(out var currentUserId)
            && eventData.OrganizerUserId == currentUserId;
        var isPublished = eventData.ReviewStatus == "APPROVED"
            && eventData.PublishStatus == "PUBLISHED";
        if (!isPublished && !isOrganizer)
            return MissingResource("找不到活動", "這場活動不存在或目前不可參加。");

        return Ok(ToEventDetails(eventData));
    }

    [Authorize]
    [HttpPost("events")]
    public async Task<ActionResult<SocialEventDetailsDto>> CreateEvent(
        CreateSocialEventRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (!await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken))
            return Forbid();

        var eventType = request.EventType.Trim().ToUpperInvariant();
        if (eventType is not ("PLAYER" or "OFFICIAL"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "活動類型無效", detail: "EventType 只能是 PLAYER 或 OFFICIAL。");
        if (eventType == "OFFICIAL" && !User.IsInRole("Admin"))
            return Forbid();
        if (request.EndAt <= request.StartAt)
            ModelState.AddModelError(nameof(request.EndAt), "結束時間必須晚於開始時間。");
        if (request.RegistrationEndAt.HasValue && request.RegistrationEndAt.Value > request.StartAt)
            ModelState.AddModelError(nameof(request.RegistrationEndAt), "報名截止時間不能晚於開始時間。");
        if (request.Latitude.HasValue != request.Longitude.HasValue)
            ModelState.AddModelError(nameof(request.Latitude), "地點座標必須同時提供緯度與經度。");
        if (string.Equals(request.PostContentMode, EventSocialPostSynchronizer.CustomMode, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(request.PostContent))
        {
            ModelState.AddModelError(nameof(request.PostContent), "選擇自訂活動貼文內容時，請輸入貼文內文。");
        }
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var now = DateTime.UtcNow;
        var eventData = new Event
        {
            Id = Guid.NewGuid(),
            EventType = eventType,
            OrganizerUserId = userId,
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            StartAt = request.StartAt,
            EndAt = request.EndAt,
            RegistrationEndAt = request.RegistrationEndAt,
            Capacity = request.Capacity,
            ReviewStatus = "PENDING",
            PublishStatus = "DRAFT",
            CreatedAt = now
        };
        var socialPost = EventSocialPostSynchronizer.Create(
            eventData,
            userId,
            now,
            request.PostContentMode,
            request.PostTitle,
            request.PostContent);
        eventData.SocialPost = socialPost;

        db.Events.Add(eventData);
        db.SocialPosts.Add(socialPost);
        await db.SaveChangesAsync(cancellationToken);

        var result = ToEventDetails(eventData);
        return CreatedAtAction(nameof(GetEvent), new { id = eventData.Id }, result);
    }

    [Authorize]
    [HttpPost("events/{id:guid}/registration")]
    public async Task<ActionResult<SocialEventDetailsDto>> RegisterEvent(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken))
            return Forbid();

        var eventData = await db.Events
            .Include(item => item.EventRegistrations)
            .Include(item => item.SocialPost)
            .SingleOrDefaultAsync(item => item.Id == id
                && item.ReviewStatus == "APPROVED"
                && item.PublishStatus == "PUBLISHED", cancellationToken);
        if (eventData is null)
            return MissingResource("找不到活動", "這場活動不存在或目前不可報名。");
        if (eventData.RegistrationEndAt.HasValue && eventData.RegistrationEndAt.Value < DateTime.UtcNow)
            return InvalidWorkflow("報名已截止", "這場活動已經超過報名截止時間。");

        var registration = eventData.EventRegistrations
            .SingleOrDefault(item => item.UserId == userId);
        if (registration is null)
        {
            var currentCount = eventData.EventRegistrations.Count(item =>
                item.Status == "REGISTERED" || item.Status == "ATTENDED");
            if (eventData.Capacity.HasValue && currentCount >= eventData.Capacity.Value)
                return InvalidWorkflow("活動已額滿", "這場活動目前沒有剩餘名額。");

            registration = new EventRegistration
            {
                Id = Guid.NewGuid(),
                EventId = eventData.Id,
                UserId = userId,
                Status = "REGISTERED",
                RegisteredAt = DateTime.UtcNow
            };
            db.EventRegistrations.Add(registration);
        }
        else if (registration.Status == "CANCELLED")
        {
            var currentCount = eventData.EventRegistrations.Count(item =>
                item.Status == "REGISTERED" || item.Status == "ATTENDED");
            if (eventData.Capacity.HasValue && currentCount >= eventData.Capacity.Value)
                return InvalidWorkflow("活動已額滿", "這場活動目前沒有剩餘名額。");
            registration.Status = "REGISTERED";
            registration.RegisteredAt = DateTime.UtcNow;
        }

        // 報名先完成，再由共用加碼服務依活動類型、有效期間與預算結算一次；
        // 沒有加碼或額度／發起人庫存不足時，服務只記錄 0，不會阻止正常報名。
        await communityRewardService.GrantEventRegistrationAsync(
            registration,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToEventDetails(eventData));
    }

    [Authorize]
    [HttpDelete("events/{id:guid}/registration")]
    public async Task<ActionResult<SocialEventDetailsDto>> CancelEventRegistration(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var eventData = await db.Events
            .Include(item => item.EventRegistrations)
            .Include(item => item.SocialPost)
            .SingleOrDefaultAsync(item => item.Id == id
                && item.ReviewStatus == "APPROVED"
                && item.PublishStatus == "PUBLISHED", cancellationToken);
        if (eventData is null)
            return MissingResource("找不到活動", "這場活動不存在或目前不可取消報名。");

        var registration = eventData.EventRegistrations
            .SingleOrDefault(item => item.UserId == userId && item.Status == "REGISTERED");
        if (registration is not null)
        {
            registration.Status = "CANCELLED";
            await db.SaveChangesAsync(cancellationToken);
        }

        return Ok(ToEventDetails(eventData));
    }

    [HttpGet("announcements")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiPage<AnnouncementDto>>> GetAnnouncements(
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.SocialPosts
            .AsNoTracking()
            .Where(item => item.Status == "PUBLISHED" && item.PostType == "ANNOUNCEMENT")
            .OrderByDescending(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Select(item => new AnnouncementDto(
                item.Id,
                item.Title,
                item.Content.Length > 180 ? item.Content.Substring(0, 180) : item.Content,
                item.Content,
                item.BoardCode,
                item.CreatedAt,
                null,
                item.UserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == item.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                item.PostType,
                item.PublisherType,
                item.EventId,
                item.CreatedAt));

        return Ok(await ApiPaging.ToPageAsync(query, page, pageSize, cancellationToken));
    }

    [Authorize]
    [HttpPost("posts")]
    public async Task<ActionResult<SocialPostDetailsDto>> CreatePost(
        CreateSocialPostRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var postType = (request.PostType ?? string.Empty).Trim().ToUpperInvariant();
        if (postType is not ("POST" or "ANNOUNCEMENT"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "貼文類型無效", detail: "貼文只能是一般貼文或公告貼文。");
        if (string.IsNullOrWhiteSpace(request.Title))
            ModelState.AddModelError(nameof(request.Title), "標題不可為空白。");
        if (string.IsNullOrWhiteSpace(request.BoardCode))
            ModelState.AddModelError(nameof(request.BoardCode), "請選擇貼文板塊。");
        if (request.Latitude.HasValue != request.Longitude.HasValue)
            ModelState.AddModelError(nameof(request.Latitude), "地點座標必須同時提供緯度與經度。");
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (request.ArtifactId.HasValue
            && !await db.Artifacts.AnyAsync(
                artifact => artifact.Id == request.ArtifactId.Value && artifact.IsActive,
                cancellationToken))
        {
            return MissingResource("找不到文物", "貼文關聯的文物不存在或目前未啟用。");
        }

        var mediaIds = (request.MediaIds ?? []).Distinct().ToArray();
        var mediaAssets = mediaIds.Length == 0
            ? []
            : await db.MediaAssets
                .Where(asset => mediaIds.Contains(asset.Id)
                    && asset.OwnerUserId == userId
                    && asset.Status == "ACTIVE"
                    && asset.PostId == null)
                .ToListAsync(cancellationToken);
        if (mediaAssets.Count != mediaIds.Length)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "圖片附件無效",
                detail: "只能附加目前帳號擁有、尚未綁定貼文且仍可使用的圖片。請重新上傳後再試。");
        }

        var now = DateTime.UtcNow;
        var post = new SocialPost
        {
            Id = Guid.NewGuid(),
            BoardCode = request.BoardCode.Trim().ToUpperInvariant(),
            UserId = userId,
            ArtifactId = request.ArtifactId,
            PostType = postType,
            PublisherType = postType == "ANNOUNCEMENT" && User.IsInRole("Admin") ? "OFFICIAL" : "COMMUNITY",
            ContentMode = "CUSTOM",
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            LocationName = string.IsNullOrWhiteSpace(request.LocationName) ? null : request.LocationName.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        };
        foreach (var mediaAsset in mediaAssets)
        {
            mediaAsset.PostId = post.Id;
            mediaAsset.UpdatedAt = now;
        }
        db.SocialPosts.Add(post);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPost), new { id = post.Id }, new SocialPostDetailsDto(
            post.Id,
            post.BoardCode,
            post.UserId,
            null,
            post.ArtifactId,
            post.EventId,
            post.PostType,
            post.PublisherType,
            post.Title,
            post.Content,
            [],
            mediaAssets
                .OrderBy(asset => asset.CreatedAt)
                .Select(ToMediaDto)
                .ToList(),
            post.LocationName,
            post.Latitude,
            post.Longitude,
            post.CreatedAt,
            post.UpdatedAt));
    }

    [Authorize]
    [HttpPost("posts/{postId:guid}/comments")]
    public async Task<ActionResult<SocialCommentDto>> CreateComment(
        Guid postId,
        CreateSocialCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (!await db.SocialPosts.AnyAsync(
                post => post.Id == postId && post.Status == "PUBLISHED",
                cancellationToken))
        {
            return MissingResource("找不到貼文", "這篇貼文不存在或目前不可留言。");
        }

        if (request.ParentCommentId.HasValue
            && !await db.SocialComments.AnyAsync(
                comment => comment.Id == request.ParentCommentId.Value
                    && comment.PostId == postId
                    && comment.Status == "PUBLISHED",
                cancellationToken))
        {
            return MissingResource("找不到上層留言", "回覆的留言不存在或目前不可見。");
        }

        var now = DateTime.UtcNow;
        var comment = new SocialComment
        {
            Id = Guid.NewGuid(),
            PostId = postId,
            ParentCommentId = request.ParentCommentId,
            UserId = userId,
            Content = request.Content.Trim(),
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        };
        db.SocialComments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPost), new { id = postId }, new SocialCommentDto(
            comment.Id,
            comment.PostId,
            comment.ParentCommentId,
            comment.UserId,
            null,
            comment.Content,
            comment.CreatedAt,
            comment.UpdatedAt));
    }

    [Authorize]
    [HttpPost("reports")]
    public async Task<ActionResult> CreateReport(
        CreateContentReportRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var targetType = request.TargetType.Trim().ToUpperInvariant();
        if (targetType is not ("POST" or "COMMENT"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "檢舉類型無效", detail: "TargetType 只能是 POST 或 COMMENT。");

        var targetExists = targetType switch
        {
            "POST" => await db.SocialPosts.AnyAsync(
                post => post.Id == request.TargetId && post.Status == "PUBLISHED",
                cancellationToken),
            "COMMENT" => await db.SocialComments.AnyAsync(
                comment => comment.Id == request.TargetId && comment.Status == "PUBLISHED",
                cancellationToken),
            _ => false
        };
        if (!targetExists)
            return MissingResource("找不到檢舉對象", "檢舉對象不存在或目前不可見。");

        if (await db.ContentReports.AnyAsync(
                report => report.ReporterUserId == userId
                    && report.TargetType == targetType
                    && report.TargetId == request.TargetId
                    && report.Status == "PENDING",
                cancellationToken))
        {
            return InvalidWorkflow("檢舉已存在", "你已經提交過相同內容的待處理檢舉。");
        }

        db.ContentReports.Add(new ContentReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = userId,
            TargetType = targetType,
            TargetId = request.TargetId,
            Reason = request.Reason.Trim(),
            Detail = string.IsNullOrWhiteSpace(request.Detail) ? null : request.Detail.Trim(),
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        return Accepted();
    }

    private static SocialMediaDto ToMediaDto(MediaAsset asset) => new(
        asset.Id,
        BuildMediaUrl(asset.Id),
        asset.AltText,
        asset.ContentType,
        asset.FileSize,
        asset.CreatedAt);

    private static string BuildMediaUrl(Guid id) => $"/api/v1/social/media/{id:D}/content";

    private SocialEventDetailsDto ToEventDetails(Event eventData)
    {
        var hasCurrentUser = TryGetCurrentUserId(out var userId);
        var isOrganizer = hasCurrentUser
            && eventData.OrganizerUserId == userId;
        var isRegistered = hasCurrentUser
            && eventData.EventRegistrations.Any(registration =>
                registration.UserId == userId
                && (registration.Status == "REGISTERED" || registration.Status == "ATTENDED"));

        return new SocialEventDetailsDto(
            eventData.Id,
            eventData.SocialPost?.Id,
            eventData.EventType,
            eventData.OrganizerUserId,
            eventData.Title,
            eventData.Content,
            eventData.Location,
            eventData.Latitude,
            eventData.Longitude,
            eventData.StartAt,
            eventData.EndAt,
            eventData.RegistrationEndAt,
            eventData.Capacity,
            eventData.EventRegistrations.Count(registration =>
                registration.Status == "REGISTERED" || registration.Status == "ATTENDED"),
            isRegistered,
            isOrganizer ? eventData.ReviewStatus : null,
            isOrganizer ? eventData.PublishStatus : null);
    }
}
