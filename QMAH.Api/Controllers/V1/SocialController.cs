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
    CommunityRewardService communityRewardService,
    INotificationService notificationService,
    ArtifactDiscussionService artifactDiscussionService) : ApiControllerBase
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
                post.MediaAssets
                    .Where(media => media.Status == "ACTIVE")
                    .OrderBy(media => media.CreatedAt)
                    .Select(media => "/api/v1/social/media/" + media.Id + "/content")
                    .FirstOrDefault(),
                post.LocationName,
                post.Latitude,
                post.Longitude,
                post.CreatedAt,
                post.UpdatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    // 標準看板清單 + 資料庫既有的看板代碼合併，讓前端的篩選選單不會漏掉舊資料用過的看板
    // （例如 GAME），做法對齊 QMAH.Web 的 SocialPostAdminController.LoadBoardCodes。
    private static readonly string[] StandardBoardCodes =
        ["GENERAL", "CATALOG", "DISCOVERY", "REVIEW", "QUESTION", "GUIDE"];

    [HttpGet("boards")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<string>>> GetBoardCodes(CancellationToken cancellationToken = default)
    {
        var existingCodes = await db.SocialPosts
            .AsNoTracking()
            .Where(post => post.Status == "PUBLISHED")
            .Select(post => post.BoardCode)
            .Distinct()
            .ToListAsync(cancellationToken);

        var boardCodes = StandardBoardCodes
            .Concat(existingCodes)
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim().ToUpperInvariant())
            .Distinct()
            .OrderBy(code => code)
            .ToList();

        return Ok(boardCodes);
    }

    [HttpGet("posts/{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<SocialPostDetailsDto>> GetPost(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        // Admin 可以看到已隱藏/已刪除的貼文，方便從檢舉列表點進來查看被檢舉當下的內容；一般使用者只能看已發布的貼文。
        var isAdmin = User.IsInRole("Admin");
        var post = await db.SocialPosts
            .AsNoTracking()
            .Where(item => item.Id == id && (item.Status == "PUBLISHED" || isAdmin))
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
        string? q,
        DateTime? startAfter,
        DateTime? startBefore,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var eventsQuery = db.Events
            .AsNoTracking()
            .Where(item => item.ReviewStatus == "APPROVED" && item.PublishStatus == "PUBLISHED");

        q = q?.Trim();
        if (!string.IsNullOrWhiteSpace(q))
        {
            eventsQuery = eventsQuery.Where(item =>
                item.Title.Contains(q)
                || item.Content.Contains(q));
        }
        if (startAfter.HasValue)
            eventsQuery = eventsQuery.Where(item => item.StartAt >= startAfter.Value);
        if (startBefore.HasValue)
            eventsQuery = eventsQuery.Where(item => item.StartAt <= startBefore.Value);

        var query = eventsQuery
            .OrderBy(item => item.StartAt)
            .Select(item => new EventListItemDto(
                item.Id,
                item.SocialPost == null ? null : item.SocialPost.Id,
                item.EventType,
                item.OrganizerUserId,
                db.UserProfiles
                    .Where(profile => profile.UserId == item.OrganizerUserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
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
                    registration.Status == "REGISTERED" || registration.Status == "ATTENDED"),
                item.SocialPost == null
                    ? null
                    : db.MediaAssets
                        .Where(media => media.PostId == item.SocialPost.Id && media.Status == "ACTIVE")
                        .OrderBy(media => media.CreatedAt)
                        .Select(media => "/api/v1/social/media/" + media.Id + "/content")
                        .FirstOrDefault()));

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
        // Admin 可以看到待審核／未發布的活動，方便從活動管理列表點進來查看完整內容再決定審核結果。
        if (!isPublished && !isOrganizer && !User.IsInRole("Admin"))
            return MissingResource("找不到活動", "這場活動不存在或目前不可參加。");

        return Ok(await ToEventDetailsAsync(eventData, cancellationToken));
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
        foreach (var mediaAsset in mediaAssets)
        {
            mediaAsset.PostId = socialPost.Id;
            mediaAsset.UpdatedAt = now;
        }

        db.Events.Add(eventData);
        db.SocialPosts.Add(socialPost);
        await db.SaveChangesAsync(cancellationToken);

        var result = await ToEventDetailsAsync(eventData, cancellationToken);
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
        var isNewRegistration = false;
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
            isNewRegistration = true;
        }
        else if (registration.Status == "CANCELLED")
        {
            var currentCount = eventData.EventRegistrations.Count(item =>
                item.Status == "REGISTERED" || item.Status == "ATTENDED");
            if (eventData.Capacity.HasValue && currentCount >= eventData.Capacity.Value)
                return InvalidWorkflow("活動已額滿", "這場活動目前沒有剩餘名額。");
            registration.Status = "REGISTERED";
            registration.RegisteredAt = DateTime.UtcNow;
            isNewRegistration = true;
        }

        // 報名先完成，再由共用加碼服務依活動類型、有效期間與預算結算一次；
        // 沒有加碼或額度／發起人庫存不足時，服務只記錄 0，不會阻止正常報名。
        await communityRewardService.GrantEventRegistrationAsync(
            registration,
            cancellationToken);

        // 只在真的變成「已報名」時通知一次，重複打同一支 API 不會一直發通知。
        if (isNewRegistration)
        {
            notificationService.QueueNotification(
                userId,
                "活動報名成功",
                $"你已成功報名活動「{eventData.Title}」。",
                $"/social/events/{eventData.Id}");
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(await ToEventDetailsAsync(eventData, cancellationToken));
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

        return Ok(await ToEventDetailsAsync(eventData, cancellationToken));
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
    [HttpPost("artifacts/{artifactId:guid}/discussion")]
    public async Task<ActionResult<EnsureArtifactDiscussionResultDto>> EnsureArtifactDiscussion(
        Guid artifactId,
        EnsureArtifactDiscussionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken))
            return Forbid();
        if (string.IsNullOrWhiteSpace(request.InitialComment))
        {
            ModelState.AddModelError(nameof(request.InitialComment), "請先留下第一則討論留言。");
            return ValidationProblem(ModelState);
        }

        // 這支端點只在會員確認後呼叫；若另一位會員剛好同時建立，service 會沿用既有串並把留言接上，
        // 讓使用者不會因競速而得到重複貼文或遺失自己已輸入的內容。
        var result = await artifactDiscussionService.EnsureAsync(
            artifactId,
            userId,
            request.InitialComment,
            cancellationToken);
        if (result is null)
            return MissingResource("找不到文物", "文物不存在或目前未啟用，暫時無法建立社群討論。");

        return Ok(new EnsureArtifactDiscussionResultDto(
            result.PostId,
            result.Created,
            result.CommentId));
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

    // 只有作者本人能改自己的貼文；活動的社群入口貼文改由活動編輯／審核流程管理，這裡不開放直接改。
    [Authorize]
    [HttpPut("posts/{id:guid}")]
    public async Task<IActionResult> UpdatePost(
        Guid id,
        UpdateSocialPostRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var post = await db.SocialPosts.SingleOrDefaultAsync(
            item => item.Id == id && item.Status == "PUBLISHED",
            cancellationToken);
        if (post is null)
            return MissingResource("找不到貼文", "這篇貼文不存在或目前不可編輯。");
        if (post.UserId != userId)
            return Forbid();
        if (post.PostType == "EVENT")
            return InvalidWorkflow("活動貼文不可直接編輯", "這篇貼文是活動的社群入口，請到活動編輯調整內容。");

        post.Title = request.Title.Trim();
        post.Content = request.Content.Trim();
        post.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "貼文已更新", post.Id, post.Title, post.Content, post.UpdatedAt });
    }

    // 軟刪除：只把 Status 改成 DELETED，不從資料庫移除，保留稽核與留言關聯。
    [Authorize]
    [HttpDelete("posts/{id:guid}")]
    public async Task<IActionResult> DeletePost(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var post = await db.SocialPosts.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (post is null)
            return NoContent();
        if (post.UserId != userId)
            return Forbid();
        if (post.PostType == "EVENT")
            return InvalidWorkflow("活動貼文不可直接刪除", "這篇貼文是活動的社群入口，請到活動管理取消活動。");
        if (post.Status == "DELETED")
            return NoContent();

        post.Status = "DELETED";
        post.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
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

        var post = await db.SocialPosts
            .Where(item => item.Id == postId && item.Status == "PUBLISHED")
            .Select(item => new { item.UserId, item.Title })
            .SingleOrDefaultAsync(cancellationToken);
        if (post is null)
            return MissingResource("找不到貼文", "這篇貼文不存在或目前不可留言。");

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

        // 自己回覆自己的貼文不用通知自己
        if (post.UserId != userId)
        {
            notificationService.QueueNotification(
                post.UserId,
                "貼文有新留言",
                $"你的貼文「{post.Title}」有新的留言：{Truncate(comment.Content, 60)}",
                $"/social/posts/{postId}");
        }

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

    // 只有留言作者本人能改自己的留言
    [Authorize]
    [HttpPut("comments/{id:guid}")]
    public async Task<IActionResult> UpdateComment(
        Guid id,
        UpdateSocialCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var comment = await db.SocialComments.SingleOrDefaultAsync(
            item => item.Id == id && item.Status == "PUBLISHED",
            cancellationToken);
        if (comment is null)
            return MissingResource("找不到留言", "這則留言不存在或目前不可編輯。");
        if (comment.UserId != userId)
            return Forbid();

        comment.Content = request.Content.Trim();
        comment.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "留言已更新", comment.Id, comment.Content, comment.UpdatedAt });
    }

    // 軟刪除：只把 Status 改成 DELETED，保留留言串與稽核紀錄。
    [Authorize]
    [HttpDelete("comments/{id:guid}")]
    public async Task<IActionResult> DeleteComment(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var comment = await db.SocialComments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (comment is null)
            return NoContent();
        if (comment.UserId != userId)
            return Forbid();
        if (comment.Status == "DELETED")
            return NoContent();

        comment.Status = "DELETED";
        comment.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
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

        var targetOwnerUserId = targetType switch
        {
            "POST" => await db.SocialPosts
                .Where(post => post.Id == request.TargetId && post.Status == "PUBLISHED")
                .Select(post => (Guid?)post.UserId)
                .SingleOrDefaultAsync(cancellationToken),
            "COMMENT" => await db.SocialComments
                .Where(comment => comment.Id == request.TargetId && comment.Status == "PUBLISHED")
                .Select(comment => (Guid?)comment.UserId)
                .SingleOrDefaultAsync(cancellationToken),
            _ => null
        };
        if (targetOwnerUserId is null)
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

        // 讓被檢舉內容的作者知道有人檢舉了自己的東西，審核結果之後另有通知。
        if (targetOwnerUserId.Value != userId)
        {
            notificationService.QueueNotification(
                targetOwnerUserId.Value,
                "你的內容被檢舉了",
                targetType == "POST" ? "你的一篇貼文被檢舉，管理員審核後會有結果通知。" : "你的一則留言被檢舉，管理員審核後會有結果通知。",
                null);
        }

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

    private static string Truncate(string value, int maxLength) =>
        value.Length > maxLength ? value[..maxLength] + "…" : value;

    private async Task<SocialEventDetailsDto> ToEventDetailsAsync(Event eventData, CancellationToken cancellationToken)
    {
        var hasCurrentUser = TryGetCurrentUserId(out var userId);
        var isOrganizer = hasCurrentUser
            && eventData.OrganizerUserId == userId;
        var isRegistered = hasCurrentUser
            && eventData.EventRegistrations.Any(registration =>
                registration.UserId == userId
                && (registration.Status == "REGISTERED" || registration.Status == "ATTENDED"));
        var organizerDisplayName = eventData.OrganizerUserId.HasValue
            ? await db.UserProfiles
                .Where(profile => profile.UserId == eventData.OrganizerUserId.Value)
                .Select(profile => profile.Nickname)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var media = eventData.SocialPost is null
            ? []
            : await db.MediaAssets
                .AsNoTracking()
                .Where(asset => asset.PostId == eventData.SocialPost.Id && asset.Status == "ACTIVE")
                .OrderBy(asset => asset.CreatedAt)
                .Select(asset => new SocialMediaDto(
                    asset.Id,
                    BuildMediaUrl(asset.Id),
                    asset.AltText,
                    asset.ContentType,
                    asset.FileSize,
                    asset.CreatedAt))
                .ToListAsync(cancellationToken);

        return new SocialEventDetailsDto(
            eventData.Id,
            eventData.SocialPost?.Id,
            eventData.EventType,
            eventData.OrganizerUserId,
            organizerDisplayName,
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
            media,
            isOrganizer ? eventData.ReviewStatus : null,
            isOrganizer ? eventData.PublishStatus : null);
    }
}
