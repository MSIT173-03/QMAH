using System.Globalization;
using System.Text;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Web.Infrastructure;
using QMAH.Web.Models;

namespace QMAH.Web.Controllers;

[Authorize(Roles = "Admin")]
public sealed class OperationsController(
    QmahDbContext db,
    IWebHostEnvironment environment,
    IConfiguration configuration) : Controller
{
    private static readonly HashSet<string> MediaStatuses = ["ACTIVE", "HIDDEN", "DELETED"];

    // 總覽先只取必要欄位，再由程式補齊沒有資料的日期
    // 這樣圖表會連續，也不需要另外建立日期表
    [HttpGet]
    public async Task<IActionResult> Index(
        OperationsFilterViewModel filter,
        CancellationToken cancellationToken = default)
    {
        var (from, toInclusive, toExclusive) = NormalizeDateRange(filter);

        // 只取圖表需要的欄位，分組與補零放在 C#，避免資料庫對複合 GroupBy 的翻譯差異
        var orderRows = await db.StoreOrders
            .AsNoTracking()
            .Where(order => order.CreatedAt >= from && order.CreatedAt < toExclusive)
            .Select(order => new { order.CreatedAt, order.PaidAt, order.TotalAmount, order.Status })
            .ToListAsync(cancellationToken);

        var paidOrders = orderRows
            .Where(order => order.PaidAt.HasValue
                && order.PaidAt.Value >= from
                && order.PaidAt.Value < toExclusive)
            .ToList();

        var memberRows = await db.Users
            .AsNoTracking()
            .Where(user => user.CreatedAt >= from && user.CreatedAt < toExclusive)
            .Select(user => new { user.CreatedAt })
            .ToListAsync(cancellationToken);
        var memberCountAtEnd = await db.Users
            .AsNoTracking()
            .CountAsync(user => user.CreatedAt < toExclusive && user.Status != "DELETED", cancellationToken);

        var gamePlayerRows = await db.GamePlayers
            .AsNoTracking()
            .Where(player => player.JoinedAt >= from && player.JoinedAt < toExclusive)
            .Select(player => new { player.JoinedAt, player.UserId })
            .ToListAsync(cancellationToken);
        var roomRows = await db.GameRooms
            .AsNoTracking()
            .Where(room => room.CreatedAt >= from && room.CreatedAt < toExclusive)
            .Select(room => new { room.CreatedAt, room.Status })
            .ToListAsync(cancellationToken);
        var roundRows = await db.GameRounds
            .AsNoTracking()
            .Where(round => round.StartedAt >= from && round.StartedAt < toExclusive)
            .Select(round => new { round.StartedAt })
            .ToListAsync(cancellationToken);
        var answerRows = await db.RoundAnswers
            .AsNoTracking()
            .Where(answer => answer.SubmittedAt >= from && answer.SubmittedAt < toExclusive)
            .Select(answer => new { answer.SubmittedAt, answer.AnswerType })
            .ToListAsync(cancellationToken);

        var postRows = await db.SocialPosts
            .AsNoTracking()
            .Where(post => post.CreatedAt >= from && post.CreatedAt < toExclusive)
            .Select(post => new { post.CreatedAt, post.PostType, post.PublisherType })
            .ToListAsync(cancellationToken);
        var commentRows = await db.SocialComments
            .AsNoTracking()
            .Where(comment => comment.CreatedAt >= from && comment.CreatedAt < toExclusive)
            .Select(comment => new { comment.CreatedAt })
            .ToListAsync(cancellationToken);
        var eventRows = await db.Events
            .AsNoTracking()
            .Where(eventData => eventData.CreatedAt >= from && eventData.CreatedAt < toExclusive)
            .Select(eventData => new
            {
                eventData.CreatedAt,
                eventData.EventType,
                eventData.ReviewStatus,
                eventData.PublishStatus
            })
            .ToListAsync(cancellationToken);
        var registrationRows = await db.EventRegistrations
            .AsNoTracking()
            .Where(registration => registration.RegisteredAt >= from && registration.RegisteredAt < toExclusive)
            .Select(registration => new { registration.RegisteredAt })
            .ToListAsync(cancellationToken);
        var mediaRows = await db.MediaAssets
            .AsNoTracking()
            .Where(asset => asset.CreatedAt >= from && asset.CreatedAt < toExclusive)
            .Select(asset => new { asset.CreatedAt, asset.Status })
            .ToListAsync(cancellationToken);

        var revenueByDate = paidOrders
            .GroupBy(order => order.PaidAt!.Value.Date)
            .ToDictionary(group => group.Key, group => new
            {
                Orders = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount)
            });
        var membersByDate = memberRows
            .GroupBy(member => member.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var playersByDate = gamePlayerRows
            .GroupBy(player => player.JoinedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var roomsByDate = roomRows
            .GroupBy(room => room.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var roundsByDate = roundRows
            .GroupBy(round => round.StartedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var answersByDate = answerRows
            .GroupBy(answer => answer.SubmittedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var postsByDate = postRows
            .GroupBy(post => post.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var commentsByDate = commentRows
            .GroupBy(comment => comment.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var eventsByDate = eventRows
            .GroupBy(eventData => eventData.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var registrationsByDate = registrationRows
            .GroupBy(registration => registration.RegisteredAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());
        var mediaByDate = mediaRows
            .GroupBy(media => media.CreatedAt.Date)
            .ToDictionary(group => group.Key, group => group.Count());

        var dateCount = (toInclusive - from).Days + 1;
        var revenueTrend = Enumerable.Range(0, dateCount)
            .Select(offset =>
            {
                var date = from.AddDays(offset);
                return revenueByDate.TryGetValue(date, out var value)
                    ? new OperationsRevenueDay(date, value.Orders, value.Revenue, membersByDate.GetValueOrDefault(date))
                    : new OperationsRevenueDay(date, 0, 0, membersByDate.GetValueOrDefault(date));
            })
            .ToList();
        var activityTrend = Enumerable.Range(0, dateCount)
            .Select(offset =>
            {
                var date = from.AddDays(offset);
                return new OperationsActivityDay(
                    date,
                    playersByDate.GetValueOrDefault(date),
                    roomsByDate.GetValueOrDefault(date),
                    roundsByDate.GetValueOrDefault(date),
                    answersByDate.GetValueOrDefault(date),
                    postsByDate.GetValueOrDefault(date),
                    commentsByDate.GetValueOrDefault(date),
                    eventsByDate.GetValueOrDefault(date),
                    registrationsByDate.GetValueOrDefault(date),
                    mediaByDate.GetValueOrDefault(date));
            })
            .ToList();

        var firstMonth = MonthStart(from);
        var lastMonth = MonthStart(toInclusive);
        var paidOrdersByMonth = paidOrders
            .GroupBy(order => MonthStart(order.PaidAt!.Value))
            .ToDictionary(group => group.Key, group => new
            {
                Orders = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount)
            });
        var membersByMonth = memberRows
            .GroupBy(member => MonthStart(member.CreatedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var playerJoinsByMonth = gamePlayerRows
            .GroupBy(player => MonthStart(player.JoinedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var uniquePlayersByMonth = gamePlayerRows
            .GroupBy(player => MonthStart(player.JoinedAt))
            .ToDictionary(group => group.Key, group => group.Select(player => player.UserId).Distinct().Count());
        var postsByMonth = postRows
            .GroupBy(post => MonthStart(post.CreatedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var commentsByMonth = commentRows
            .GroupBy(comment => MonthStart(comment.CreatedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var eventsByMonth = eventRows
            .GroupBy(eventData => MonthStart(eventData.CreatedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var registrationsByMonth = registrationRows
            .GroupBy(registration => MonthStart(registration.RegisteredAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var mediaByMonth = mediaRows
            .GroupBy(media => MonthStart(media.CreatedAt))
            .ToDictionary(group => group.Key, group => group.Count());
        var monthlyTrend = new List<OperationsMonthSummary>();
        // 月份也補齊沒有資料的區間，長期圖表才不會斷軸
        for (var month = firstMonth; month <= lastMonth; month = month.AddMonths(1))
        {
            paidOrdersByMonth.TryGetValue(month, out var monthlyOrders);
            monthlyTrend.Add(new OperationsMonthSummary(
                month,
                membersByMonth.GetValueOrDefault(month),
                monthlyOrders?.Orders ?? 0,
                monthlyOrders?.Revenue ?? 0,
                playerJoinsByMonth.GetValueOrDefault(month),
                uniquePlayersByMonth.GetValueOrDefault(month),
                postsByMonth.GetValueOrDefault(month),
                commentsByMonth.GetValueOrDefault(month),
                eventsByMonth.GetValueOrDefault(month),
                registrationsByMonth.GetValueOrDefault(month),
                mediaByMonth.GetValueOrDefault(month)));
        }

        var paidRevenue = paidOrders.Sum(order => order.TotalAmount);
        var model = new OperationsDashboardViewModel
        {
            From = from,
            To = toInclusive,
            PaidOrderCount = paidOrders.Count,
            CreatedOrderCount = orderRows.Count,
            CancelledOrderCount = orderRows.Count(order => order.Status == "CANCELLED"),
            PaidRevenue = paidRevenue,
            AverageOrderAmount = paidOrders.Count == 0 ? 0 : paidRevenue / paidOrders.Count,
            GamePlayerJoinCount = gamePlayerRows.Count,
            UniqueGameUserCount = gamePlayerRows.Select(player => player.UserId).Distinct().Count(),
            NewMemberCount = memberRows.Count,
            MemberCountAtEnd = memberCountAtEnd,
            GameRoomCount = roomRows.Count,
            GameRoundCount = roundRows.Count,
            GameAnswerCount = answerRows.Count,
            SocialPostCount = postRows.Count,
            SocialCommentCount = commentRows.Count,
            EventCount = eventRows.Count,
            EventRegistrationCount = registrationRows.Count,
            MediaAssetCount = mediaRows.Count,
            RevenueTrend = revenueTrend,
            ActivityTrend = activityTrend,
            MonthlyTrend = monthlyTrend,
            Charts = BuildDashboardCharts(monthlyTrend),
            OrderStatusBreakdown = BuildBreakdown(orderRows.Select(order => order.Status), AdminDisplayLabels.Status),
            GameRoomStatusBreakdown = BuildBreakdown(roomRows.Select(room => room.Status), AdminDisplayLabels.Status),
            AnswerTypeBreakdown = BuildBreakdown(answerRows.Select(answer => answer.AnswerType), AdminDisplayLabels.AnswerType),
            SocialPostBreakdown = BuildBreakdown(postRows.Select(post => post.PostType), AdminDisplayLabels.PostType),
            SocialPublisherBreakdown = BuildBreakdown(postRows.Select(post => post.PublisherType), AdminDisplayLabels.PublisherType),
            EventTypeBreakdown = BuildBreakdown(eventRows.Select(eventData => eventData.EventType), AdminDisplayLabels.EventType),
            EventReviewBreakdown = BuildBreakdown(eventRows.Select(eventData => eventData.ReviewStatus), AdminDisplayLabels.ReviewStatus),
            EventPublishBreakdown = BuildBreakdown(eventRows.Select(eventData => eventData.PublishStatus), AdminDisplayLabels.PublishStatus),
            MediaBreakdown = BuildBreakdown(mediaRows.Select(media => media.Status), AdminDisplayLabels.Status)
        };

        ViewData["Title"] = "營運中心";
        ViewData["AdminDescription"] = "依日期範圍查看會員、營收、遊戲、社群、活動與社群媒體的長期資料；這裡是資料庫統計，不是即時監控。";
        return View(model);
    }

    // 明細頁沿用總覽的日期規則，並提供完整序列與資料點
    [HttpGet]
    public async Task<IActionResult> Details(
        string? metric,
        OperationsFilterViewModel filter,
        CancellationToken cancellationToken = default)
    {
        var (from, toInclusive, toExclusive) = NormalizeDateRange(filter);
        var model = await BuildMetricDetailsAsync(
            metric,
            from,
            toInclusive,
            toExclusive,
            cancellationToken);

        ViewData["Title"] = $"{model.MetricLabel}明細";
        ViewData["AdminDescription"] = model.MetricDescription;
        return View(model);
    }

    // 匯出沿用明細頁的查詢結果，避免畫面與檔案的統計口徑不同
    [HttpGet]
    public async Task<IActionResult> Export(
        string? metric,
        OperationsFilterViewModel filter,
        CancellationToken cancellationToken = default)
    {
        var (from, toInclusive, toExclusive) = NormalizeDateRange(filter);
        var model = await BuildMetricDetailsAsync(
            metric,
            from,
            toInclusive,
            toExclusive,
            cancellationToken);

        var csv = new StringBuilder();
        // UTF-8 BOM 讓 Excel 開啟繁中 CSV 時能正確辨識編碼
        csv.Append('\uFEFF');
        csv.Append(EscapeCsv("日期"));
        foreach (var series in model.Series)
        {
            csv.Append(',').Append(EscapeCsv(series.Label));
        }

        csv.AppendLine();
        foreach (var point in model.Points)
        {
            csv.Append(EscapeCsv(point.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
            for (var index = 0; index < model.Series.Count; index++)
            {
                var value = model.Series[index].ValueFormat == "currency"
                    ? point.Values[index].ToString("0.##", CultureInfo.InvariantCulture)
                    : point.Values[index].ToString("0", CultureInfo.InvariantCulture);
                csv.Append(',').Append(EscapeCsv(value));
            }

            csv.AppendLine();
        }

        var fileName = $"qmah-operations-{model.MetricCode}-{from:yyyyMMdd}-{toInclusive:yyyyMMdd}.csv";
        return File(
            Encoding.UTF8.GetBytes(csv.ToString()),
            "text/csv; charset=utf-8",
            fileName);
    }

    // 先在資料庫篩選與分頁，再只補查當頁的操作者名稱
    [HttpGet]
    public async Task<IActionResult> AuditLogs(
        AuditLogFilterViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();
        filter.AreaCode = NormalizeAuditArea(filter.AreaCode);
        filter.StatusCode = filter.StatusCode is >= 100 and <= 599 ? filter.StatusCode : null;
        filter.PageSize = filter.PageSize is 10 or 20 or 50 or 100 ? filter.PageSize : 20;
        filter.Page = Math.Max(1, filter.Page);

        var query = db.AuditLogs.AsNoTracking();
        if (filter.Keyword is not null)
        {
            query = query.Where(log =>
                log.Controller.Contains(filter.Keyword)
                || log.Action.Contains(filter.Keyword)
                || log.RequestPath.Contains(filter.Keyword)
                || (log.Detail != null && log.Detail.Contains(filter.Keyword))
                || db.UserProfiles.Any(profile =>
                    profile.UserId == log.ActorUserId
                    && profile.Nickname.Contains(filter.Keyword)));
        }

        if (filter.AreaCode is not null)
            query = query.Where(log => log.Area == filter.AreaCode);

        if (filter.From.HasValue)
            query = query.Where(log => log.OccurredAt >= filter.From.Value.Date);
        if (filter.To.HasValue)
            query = query.Where(log => log.OccurredAt < filter.To.Value.Date.AddDays(1));
        if (filter.StatusCode.HasValue)
            query = query.Where(log => log.ResultStatusCode == filter.StatusCode.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)filter.PageSize);
        filter.Page = totalPages == 0 ? 1 : Math.Min(filter.Page, totalPages);

        var logs = await query
            .OrderByDescending(log => log.OccurredAt)
            .ThenByDescending(log => log.Id)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(log => new AuditLogListItemViewModel
            {
                Id = log.Id,
                ActorUserId = log.ActorUserId,
                Area = log.Area,
                Controller = log.Controller,
                Action = log.Action,
                HttpMethod = log.HttpMethod,
                ResultStatusCode = log.ResultStatusCode,
                Detail = log.Detail,
                OccurredAt = log.OccurredAt
            })
            .ToListAsync(cancellationToken);

        var actorIds = logs
            .Where(log => log.ActorUserId.HasValue)
            .Select(log => log.ActorUserId!.Value)
            .Distinct()
            .ToArray();
        var actorNames = await db.UserProfiles
            .AsNoTracking()
            .Where(profile => actorIds.Contains(profile.UserId))
            .ToDictionaryAsync(profile => profile.UserId, profile => profile.Nickname, cancellationToken);
        foreach (var log in logs)
        {
            if (log.ActorUserId.HasValue && actorNames.TryGetValue(log.ActorUserId.Value, out var actorName))
                log.ActorName = actorName;
        }

        filter.TotalCount = totalCount;
        filter.TotalPages = totalPages;
        filter.Items = logs;
        ViewData["Title"] = "稽核紀錄";
        ViewData["AdminDescription"] = "記錄後台管理操作的時間、目標與結果；不保存密碼、Token 或請求內容。";
        return View(filter);
    }

    // 媒體清單只查畫面需要的欄位，關聯顯示名稱而不是儲存路徑
    [HttpGet]
    public async Task<IActionResult> Media(
        MediaAdminFilterViewModel filter,
        CancellationToken cancellationToken = default)
    {
        filter.Keyword = string.IsNullOrWhiteSpace(filter.Keyword) ? null : filter.Keyword.Trim();
        filter.Status = string.IsNullOrWhiteSpace(filter.Status) ? null : filter.Status.Trim().ToUpperInvariant();
        filter.PageSize = Math.Clamp(filter.PageSize, 10, 100);
        filter.Page = Math.Max(1, filter.Page);

        var query = db.MediaAssets.AsNoTracking();
        if (filter.Keyword is not null)
        {
            query = query.Where(asset =>
                asset.OriginalFileName.Contains(filter.Keyword)
                || (asset.AltText != null && asset.AltText.Contains(filter.Keyword)));
        }
        if (filter.Status is not null && MediaStatuses.Contains(filter.Status))
            query = query.Where(asset => asset.Status == filter.Status);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)filter.PageSize);
        filter.Page = totalPages == 0 ? 1 : Math.Min(filter.Page, totalPages);

        var media = await query
            .OrderByDescending(asset => asset.CreatedAt)
            .ThenByDescending(asset => asset.SequenceNo)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(asset => new MediaAdminItemViewModel
            {
                Id = asset.Id,
                SequenceNo = asset.SequenceNo,
                OriginalFileName = asset.OriginalFileName,
                ContentType = asset.ContentType,
                FileSize = asset.FileSize,
                AltText = asset.AltText,
                Status = asset.Status,
                OwnerName = db.UserProfiles
                    .Where(profile => profile.UserId == asset.OwnerUserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault() ?? "未設定暱稱",
                PostId = asset.PostId,
                PostTitle = db.SocialPosts
                    .Where(post => post.Id == asset.PostId)
                    .Select(post => post.Title)
                    .FirstOrDefault(),
                PostAuthorName = db.SocialPosts
                    .Where(post => post.Id == asset.PostId)
                    .Join(
                        db.UserProfiles,
                        post => post.UserId,
                        profile => profile.UserId,
                        (_, profile) => profile.Nickname)
                    .FirstOrDefault(),
                AvatarOwnerName = db.UserProfiles
                    .Where(profile => profile.AvatarPath == asset.StoredPath)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault(),
                CreatedAt = asset.CreatedAt
            })
            .ToListAsync(cancellationToken);

        filter.AvatarItems = await db.UserProfiles
            .AsNoTracking()
            .Where(profile => profile.AvatarPath != null && profile.AvatarPath != "")
            .OrderBy(profile => profile.Nickname)
            .Select(profile => new AvatarAdminItemViewModel
            {
                UserId = profile.UserId,
                OwnerName = profile.Nickname,
                AvatarPath = profile.AvatarPath!
            })
            .ToListAsync(cancellationToken);

        filter.TotalCount = totalCount;
        filter.TotalPages = totalPages;
        filter.Items = media;
        ViewData["Title"] = "圖庫管理";
        ViewData["AdminDescription"] = "查看社群上傳圖片、替圖片下架或恢復；檔案透過管理權限受控讀取。";
        return View(filter);
    }

    [HttpGet]
    public async Task<IActionResult> MediaContent(Guid id, CancellationToken cancellationToken = default)
    {
        var asset = await db.MediaAssets
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id && item.Status != "DELETED", cancellationToken);
        if (asset is null)
            return NotFound();

        string physicalPath;
        try
        {
            physicalPath = ResolveMediaPath(asset.StoredPath);
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
        if (!System.IO.File.Exists(physicalPath))
            return NotFound();

        Response.Headers.CacheControl = "no-store";
        return PhysicalFile(physicalPath, asset.ContentType, enableRangeProcessing: true);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetMediaStatus(
        Guid id,
        string? status,
        CancellationToken cancellationToken = default)
    {
        status = status?.Trim().ToUpperInvariant();
        if (status is null || !MediaStatuses.Contains(status))
            return BadRequest("不支援的圖片狀態。");

        var asset = await db.MediaAssets.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (asset is null)
            return NotFound();
        if (status == "ACTIVE")
        {
            try
            {
                if (!System.IO.File.Exists(ResolveMediaPath(asset.StoredPath)))
                {
                    TempData["ErrorMessage"] = "找不到實體圖片檔案，無法恢復顯示。";
                    return RedirectToAction(nameof(Media));
                }
            }
            catch (InvalidOperationException)
            {
                TempData["ErrorMessage"] = "圖片檔案位置不符合目前的儲存規則，無法恢復顯示。";
                return RedirectToAction(nameof(Media));
            }
        }

        asset.Status = status;
        asset.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = $"圖片狀態已更新為：{status switch
        {
            "ACTIVE" => "可使用",
            "HIDDEN" => "已隱藏",
            "DELETED" => "已刪除",
            _ => status
        }}。";
        return RedirectToAction(nameof(Media));
    }

    // 明細依指標只查需要的時間欄位，日期軸由程式補齊，沒有事件的日子顯示 0
    private async Task<OperationsMetricDetailsViewModel> BuildMetricDetailsAsync(
        string? metric,
        DateTime from,
        DateTime toInclusive,
        DateTime toExclusive,
        CancellationToken cancellationToken)
    {
        var metricCode = NormalizeMetric(metric);
        var (metricLabel, metricDescription) = GetMetricCopy(metricCode);
        var series = GetMetricSeries(metricCode);
        var dates = Enumerable.Range(0, (toInclusive - from).Days + 1)
            .Select(offset => from.AddDays(offset))
            .ToArray();
        // 先建立完整日期軸，查不到的日期保留 0，不讓折線圖把空白誤解成缺資料
        var valuesByDate = dates.ToDictionary(date => date, _ => new decimal[series.Count]);

        void AddValue(DateTime timestamp, int seriesIndex, decimal value)
        {
            // 查詢結果只會累加到目前日期範圍，範圍外資料直接忽略
            if (valuesByDate.TryGetValue(timestamp.Date, out var values))
                values[seriesIndex] += value;
        }

        switch (metricCode)
        {
            case "revenue":
            {
                var rows = await db.StoreOrders
                    .AsNoTracking()
                    .Where(order => order.PaidAt != null
                        && order.PaidAt >= from
                        && order.PaidAt < toExclusive)
                    .Select(order => new { PaidAt = order.PaidAt!.Value, order.TotalAmount })
                    .ToListAsync(cancellationToken);
                foreach (var row in rows)
                    AddValue(row.PaidAt, 0, row.TotalAmount);
                break;
            }
            case "members":
            {
                var rows = await db.Users
                    .AsNoTracking()
                    .Where(user => user.CreatedAt >= from && user.CreatedAt < toExclusive)
                    .Select(user => user.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in rows)
                    AddValue(row, 0, 1);
                break;
            }
            case "orders":
            {
                var rows = await db.StoreOrders
                    .AsNoTracking()
                    .Where(order => order.CreatedAt >= from && order.CreatedAt < toExclusive)
                    .Select(order => new { order.CreatedAt, order.PaidAt })
                    .ToListAsync(cancellationToken);
                foreach (var row in rows)
                {
                    AddValue(row.CreatedAt, 0, 1);
                    if (row.PaidAt is { } paidAt && paidAt >= from && paidAt < toExclusive)
                        AddValue(paidAt, 1, 1);
                }
                break;
            }
            case "game":
            {
                var playerRows = await db.GamePlayers
                    .AsNoTracking()
                    .Where(player => player.JoinedAt >= from && player.JoinedAt < toExclusive)
                    .Select(player => player.JoinedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in playerRows)
                    AddValue(row, 0, 1);

                var roomRows = await db.GameRooms
                    .AsNoTracking()
                    .Where(room => room.CreatedAt >= from && room.CreatedAt < toExclusive)
                    .Select(room => room.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in roomRows)
                    AddValue(row, 1, 1);

                var roundRows = await db.GameRounds
                    .AsNoTracking()
                    .Where(round => round.StartedAt >= from && round.StartedAt < toExclusive)
                    .Select(round => round.StartedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in roundRows)
                    AddValue(row, 2, 1);

                var answerRows = await db.RoundAnswers
                    .AsNoTracking()
                    .Where(answer => answer.SubmittedAt >= from && answer.SubmittedAt < toExclusive)
                    .Select(answer => answer.SubmittedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in answerRows)
                    AddValue(row, 3, 1);
                break;
            }
            case "activity":
            {
                var memberRows = await db.Users
                    .AsNoTracking()
                    .Where(user => user.CreatedAt >= from && user.CreatedAt < toExclusive)
                    .Select(user => user.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in memberRows)
                    AddValue(row, 0, 1);

                var playerRows = await db.GamePlayers
                    .AsNoTracking()
                    .Where(player => player.JoinedAt >= from && player.JoinedAt < toExclusive)
                    .Select(player => player.JoinedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in playerRows)
                    AddValue(row, 1, 1);

                var postRows = await db.SocialPosts
                    .AsNoTracking()
                    .Where(post => post.CreatedAt >= from && post.CreatedAt < toExclusive)
                    .Select(post => post.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in postRows)
                    AddValue(row, 2, 1);

                var registrationRows = await db.EventRegistrations
                    .AsNoTracking()
                    .Where(registration => registration.RegisteredAt >= from && registration.RegisteredAt < toExclusive)
                    .Select(registration => registration.RegisteredAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in registrationRows)
                    AddValue(row, 3, 1);
                break;
            }
            case "social":
            {
                var postRows = await db.SocialPosts
                    .AsNoTracking()
                    .Where(post => post.CreatedAt >= from && post.CreatedAt < toExclusive)
                    .Select(post => post.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in postRows)
                    AddValue(row, 0, 1);

                var commentRows = await db.SocialComments
                    .AsNoTracking()
                    .Where(comment => comment.CreatedAt >= from && comment.CreatedAt < toExclusive)
                    .Select(comment => comment.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in commentRows)
                    AddValue(row, 1, 1);
                break;
            }
            case "events":
            {
                var eventRows = await db.Events
                    .AsNoTracking()
                    .Where(eventData => eventData.CreatedAt >= from && eventData.CreatedAt < toExclusive)
                    .Select(eventData => eventData.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in eventRows)
                    AddValue(row, 0, 1);

                var registrationRows = await db.EventRegistrations
                    .AsNoTracking()
                    .Where(registration => registration.RegisteredAt >= from && registration.RegisteredAt < toExclusive)
                    .Select(registration => registration.RegisteredAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in registrationRows)
                    AddValue(row, 1, 1);
                break;
            }
            case "media":
            {
                var rows = await db.MediaAssets
                    .AsNoTracking()
                    .Where(asset => asset.CreatedAt >= from && asset.CreatedAt < toExclusive)
                    .Select(asset => asset.CreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var row in rows)
                    AddValue(row, 0, 1);
                break;
            }
        }

        var points = dates
            .Select(date => new OperationsMetricPoint(date, valuesByDate[date]))
            .ToArray();
        var chart = new OperationsChartViewModel
        {
            Id = $"operations-{metricCode}-chart",
            Title = $"{metricLabel}趨勢",
            Description = metricDescription,
            Labels = dates.Select(date => date.ToString("MM/dd", CultureInfo.InvariantCulture)).ToArray(),
            Series = series
                .Select((item, index) => new OperationsChartSeries(
                    item.Label,
                    item.ValueFormat,
                    points.Select(point => point.Values[index]).ToArray()))
                .ToArray()
        };
        var summaries = series
            .Select((item, index) => new OperationsMetricSummary(
                item.Label,
                item.ValueFormat,
                points.Sum(point => point.Values[index])))
            .ToArray();

        return new OperationsMetricDetailsViewModel
        {
            From = from,
            To = toInclusive,
            MetricCode = metricCode,
            MetricLabel = metricLabel,
            MetricDescription = metricDescription,
            GranularityLabel = "每日",
            Series = series,
            Points = points,
            Summaries = summaries,
            Chart = chart
        };
    }

    // 總覽只放兩張摘要圖，完整序列與匯出入口留在明細頁
    private static IReadOnlyList<OperationsChartViewModel> BuildDashboardCharts(
        IReadOnlyList<OperationsMonthSummary> months)
    {
        var labels = months
            .Select(item => item.Month.ToString("yyyy/MM", CultureInfo.InvariantCulture))
            .ToArray();

        return
        [
            new OperationsChartViewModel
            {
                Id = "operations-revenue-overview-chart",
                Title = "已付款營收趨勢",
                Description = "以月份比較已完成付款的訂單金額。",
                Labels = labels,
                Series =
                [
                    new OperationsChartSeries(
                        "已付款營收",
                        "currency",
                        months.Select(item => item.Revenue).ToArray())
                ]
            },
            new OperationsChartViewModel
            {
                Id = "operations-activity-overview-chart",
                Title = "主要功能使用趨勢",
                Description = "以月份比較新增會員、遊戲加入、貼文與活動報名。",
                Labels = labels,
                Series =
                [
                    new OperationsChartSeries("新增會員", "number", months.Select(item => (decimal)item.NewMemberCount).ToArray()),
                    new OperationsChartSeries("遊戲加入", "number", months.Select(item => (decimal)item.GameJoinCount).ToArray()),
                    new OperationsChartSeries("貼文", "number", months.Select(item => (decimal)item.PostCount).ToArray()),
                    new OperationsChartSeries("活動報名", "number", months.Select(item => (decimal)item.EventRegistrationCount).ToArray())
                ]
            }
        ];
    }

    private static IReadOnlyList<OperationsMetricSeries> GetMetricSeries(string metricCode) => metricCode switch
    {
        "revenue" => [new("已付款營收", "currency")],
        "members" => [new("新增會員", "number")],
        "orders" => [new("建立訂單", "number"), new("完成付款", "number")],
        "game" =>
        [
            new("遊戲加入", "number"),
            new("房間建立", "number"),
            new("回合開始", "number"),
            new("作答紀錄", "number")
        ],
        "activity" =>
        [
            new("新增會員", "number"),
            new("遊戲加入", "number"),
            new("貼文", "number"),
            new("活動報名", "number")
        ],
        "social" => [new("貼文", "number"), new("留言", "number")],
        "events" => [new("活動建立", "number"), new("活動報名", "number")],
        "media" => [new("社群圖片", "number")],
        _ => [new("已付款營收", "currency")]
    };

    private static (string Label, string Description) GetMetricCopy(string metricCode) => metricCode switch
    {
        "revenue" => ("營收", "依付款完成時間統計；下方保留每日明細，方便對照訂單紀錄。"),
        "members" => ("會員成長", "依帳號建立時間統計新增會員，不代表同期間的活躍人數。"),
        "orders" => ("訂單", "以訂單建立與付款完成兩條序列並列，協助比較交易流程的時間差。"),
        "game" => ("遊戲使用", "依玩家加入、房間建立、回合開始與作答紀錄統計，這些是歷史事件，不是即時在線人數。"),
        "activity" => ("主要功能使用", "以新增會員、遊戲加入、社群貼文與活動報名並列，方便比較不同功能的使用變化。"),
        "social" => ("社群互動", "依貼文與留言建立時間統計，活動貼文也會計入社群內容。"),
        "events" => ("活動參與", "依活動建立與報名時間統計，方便查看活動供給與參與變化。"),
        "media" => ("社群圖片", "只統計社群上傳的圖片資產，官方文物圖鑑圖片不列入。"),
        _ => ("營收", "依付款完成時間統計；下方保留每日明細，方便對照訂單紀錄。")
    };

    // 指標代碼只接受已知值，其他輸入回到營收，避免網址參數造成不一致
    private static string NormalizeMetric(string? metric) => metric?.Trim().ToLowerInvariant() switch
    {
        "members" => "members",
        "orders" => "orders",
        "game" => "game",
        "activity" => "activity",
        "social" => "social",
        "events" => "events",
        "media" => "media",
        _ => "revenue"
    };

    private static string? NormalizeAuditArea(string? area) => area?.Trim().ToUpperInvariant() switch
    {
        "ROOT" => "Root",
        "CATALOG" => "Catalog",
        "GAME" => "Game",
        "SOCIAL" => "Social",
        "STORE" => "Store",
        "USER" => "User",
        _ => null
    };

    private static string EscapeCsv(string value) =>
        value.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;

    // 媒體檔案只能落在設定的根目錄，先解析完整路徑再防止路徑穿越
    private string ResolveMediaPath(string relativePath)
    {
        var configuredRoot = configuration["Media:RootPath"] ?? "wwwroot/media";
        var root = Path.GetFullPath(
            Path.IsPathRooted(configuredRoot)
                ? configuredRoot
                : Path.Combine(environment.ContentRootPath, configuredRoot));
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath));
        var rootWithSeparator = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("媒體檔案路徑超出設定的儲存根目錄。");
        return fullPath;
    }

    // 狀態代碼先轉成人看得懂的文字再計數，UI 不需要知道資料庫內部值
    private static IReadOnlyList<OperationsBreakdown> BuildBreakdown(
        IEnumerable<string?> values,
        Func<string?, string> formatter)
    {
        return values
            .Select(value => ToDisplayLabel(value, formatter))
            .GroupBy(label => label)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key)
            .Select(group => new OperationsBreakdown(group.Key, group.Count()))
            .ToList();
    }

    private static string ToDisplayLabel(string? value, Func<string?, string> formatter)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "未設定";

        var display = formatter(value);
        return string.IsNullOrWhiteSpace(display)
            || string.Equals(display, value.Trim(), StringComparison.OrdinalIgnoreCase)
            ? "其他"
            : display;
    }

    private static DateTime MonthStart(DateTime value) => new(value.Year, value.Month, 1);

    // 所有營運查詢共用半開區間 [from, toExclusive)，避免漏算最後一天
    private static (DateTime From, DateTime ToInclusive, DateTime ToExclusive) NormalizeDateRange(
        OperationsFilterViewModel filter)
    {
        var toInclusive = (filter.To ?? DateTime.UtcNow).Date;
        var hasPresetRange = filter.Days is 7 or 30 or 90 or 180 or 365;
        var days = hasPresetRange ? filter.Days!.Value : 30;
        var from = (hasPresetRange
                ? toInclusive.AddDays(-(days - 1))
                : filter.From ?? toInclusive.AddDays(-(days - 1)))
            .Date;
        if (from > toInclusive)
            (from, toInclusive) = (toInclusive, from);

        // 歷史趨勢頁限制在一年內，避免誤傳日期造成過大的逐日資料。
        if ((toInclusive - from).Days > 364)
            from = toInclusive.AddDays(-364);
        return (from, toInclusive, toInclusive.AddDays(1));
    }
}
