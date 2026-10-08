using System.Data.Common;
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using QMAH.Api.Controllers.V1;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Services.Economy;

// SQL 翻譯與取消請求檢查：攔截所有連線，不存取任何資料庫。
var options = new DbContextOptionsBuilder<QmahDbContext>()
    .UseSqlServer("Server=unused;Database=unused;Integrated Security=true")
    .AddInterceptors(new CancelBeforeConnection()).Options;
await using var db = new QmahDbContext(options);
var daily = new GameDailyRewardService(db);
var economy = new EconomyService(db, daily);
var paths = QmahMediaStoragePaths.Resolve(new ConfigurationBuilder().Build(), Path.GetTempPath());
var miniGame = new MiniGameService(db, economy, new ScrollPaintingEligibility(paths), daily);
var economyController = new EconomyController(economy);
var gameController = new MiniGameController(miniGame, daily, economy,
    new QmahMediaUrlResolver(Options.Create(new MediaDeliveryOptions())));
var userId = Guid.NewGuid();
foreach (var controller in new ControllerBase[] { economyController, gameController })
    controller.ControllerContext = new ControllerContext
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "checks"))
        }
    };

using var cancelled = new CancellationTokenSource();
cancelled.Cancel();
Check((await economyController.GetEconomy(cancelled.Token)).Result is StatusCodeResult { StatusCode: 499 }, "會員資產取消只結束請求");
Check((await gameController.GetRewardStatus(cancelled.Token)).Result is StatusCodeResult { StatusCode: 499 }, "每日獎勵取消只結束請求");
await MustPropagate(async () => { await economyController.GetEconomy(); }, "會員資產未取消的例外仍向外傳遞");
await MustPropagate(async () => { await gameController.GetRewardStatus(); }, "每日獎勵未取消的例外仍向外傳遞");

var reviews = new StoreReviewsController(db);
var buildQuery = typeof(StoreReviewsController).GetMethod("BuildReviewQuery", BindingFlags.Instance | BindingFlags.NonPublic)!;
foreach (var byUser in new[] { true, false })
{
    var filterId = byUser ? userId : Guid.NewGuid();
    var query = (IQueryable<ProductReviewDto>)buildQuery.Invoke(reviews,
        [Guid.NewGuid(), false, byUser ? filterId : null, byUser ? null : filterId])!;
    var sql = query.ToQueryString();
    Check(sql.Contains("WHERE") && sql.Contains(filterId.ToString(), StringComparison.OrdinalIgnoreCase),
        byUser ? "自己的商品評價可翻譯為 SQL" : "儲存後的商品評價可翻譯為 SQL");
}

economyController.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
gameController.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity());
Check((await economyController.GetEconomy()).Result is UnauthorizedResult, "未登入不能讀取會員資產");
Check((await gameController.GetRewardStatus()).Result is UnauthorizedResult, "未登入不能讀取每日獎勵");

var online = new QMAH.Api.Hubs.NotificationConnections();
online.Add("one", userId); online.Add("two", userId);
online.Remove("one");
Check(online.Users.SequenceEqual(new[] { userId }), "同會員多分頁不重複查詢且保留仍在線的連線");
online.Remove("two");
Check(online.Users.Length == 0, "最後連線離開即停止該會員通知查詢");
Check(typeof(QMAH.Api.Hubs.NotificationHub).IsDefined(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute)), "通知連線必須登入");
var notificationSql = db.UserNotifications.AsNoTracking().Where(item => new[] { userId }.Contains(item.UserId))
    .GroupBy(item => item.UserId).Select(group => new {
        Id = group.Key, Count = group.Count(), Unread = group.Count(item => !item.IsRead),
        Created = group.Max(item => item.CreatedAt), Read = group.Max(item => item.ReadAt)
    }).ToQueryString();
Check(notificationSql.Contains("GROUP BY") && notificationSql.Contains("WHERE"), "通知彙總由 SQL 篩選線上會員且不讀取通知內容");
var mediaRoot = Path.Combine(Path.GetTempPath(), "qmah-media-checks");
foreach (var storedPath in new[] { "social/pending/1.png", "social/posts/one/2.webp", "/media/catalog/sample.jpg" })
{
    Check(QMAH.Api.Infrastructure.Media.SocialMediaPath.TryResolve(mediaRoot, storedPath, out var resolved)
        && resolved.StartsWith(mediaRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal), "媒體路徑可讀取：" + storedPath);
}
Check(QMAH.Api.Infrastructure.Media.SocialMediaPath.TryResolve(mediaRoot, "/media/catalog/sample.jpg", out var legacy)
    && legacy == Path.Combine(mediaRoot, "catalog", "sample.jpg"), "舊公開媒體 URL 正確對應根目錄內的檔案");
foreach (var storedPath in new[] { "../secret.png", "/media/../secret.png", "/etc/passwd", @"C:\secret.png", @"\\server\share\secret.png", "social/file.png:stream", "https://example.com/image.png", "", "/media/", "social/\0.png" })
{
    Check(!QMAH.Api.Infrastructure.Media.SocialMediaPath.TryResolve(mediaRoot, storedPath, out _), "拒絕不安全或無效媒體路徑");
}

static void Check(bool passed, string name)
{
    if (!passed) throw new InvalidOperationException(name);
    Console.WriteLine("PASS " + name);
}
static async Task MustPropagate(Func<Task> action, string name)
{
    try { await action(); }
    catch (OperationCanceledException) { Check(true, name); return; }
    throw new InvalidOperationException(name);
}
sealed class CancelBeforeConnection : DbConnectionInterceptor
{
    public override ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection, ConnectionEventData eventData,
        InterceptionResult result, CancellationToken cancellationToken = default)
        => throw new OperationCanceledException(cancellationToken);
}
