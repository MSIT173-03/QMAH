using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;

namespace QMAH.Web.Controllers;

[Authorize(Roles = "Admin")]
[Route("admin/emergency")]
public sealed class AdminEmergencyController(QmahDbContext db) : Controller
{
    [HttpPost("force-delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ForceDelete(string type, Guid id, CancellationToken cancellationToken)
    {
        type = (type ?? string.Empty).Trim().ToLowerInvariant();

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            switch (type)
            {
                case "answer":
                    await ForceDeleteAnswerAsync(id, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "作答與其投票已強制刪除。";
                    return RedirectToAction("Index", "Answers", new { area = "Game" });

                case "round":
                    await ForceDeleteRoundAsync(id, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "回合與其作答、投票及解鎖關聯已強制刪除。";
                    return RedirectToAction("Index", "Rounds", new { area = "Game" });

                case "player":
                    await ForceDeletePlayerAsync(id, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "玩家與其遊戲紀錄已強制刪除。";
                    return RedirectToAction("Index", "Players", new { area = "Game" });

                case "room":
                    await ForceDeleteRoomAsync(id, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "房間與其完整遊戲紀錄已強制刪除。";
                    return RedirectToAction("Index", "Rooms", new { area = "Game" });

                case "achievement":
                {
                    var achievement = await db.Achievements.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
                    if (achievement is null) return NotFound();

                    var earned = await db.UserAchievements.Where(x => x.AchievementId == id).ToListAsync(cancellationToken);
                    db.UserAchievements.RemoveRange(earned);
                    db.Achievements.Remove(achievement);

                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "成就與會員取得紀錄已強制刪除。";
                    return RedirectToAction("Index", "Achievements", new { area = "User" });
                }

                case "coupon":
                {
                    var definition = await db.CouponDefinitions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
                    if (definition is null) return NotFound();

                    var userCoupons = await db.UserCoupons.Where(x => x.CouponDefinitionId == id).ToListAsync(cancellationToken);
                    var userCouponIds = userCoupons.Select(x => x.Id).ToList();

                    if (userCouponIds.Count > 0)
                    {
                        var orders = await db.StoreOrders.Where(x => x.UserCouponId.HasValue && userCouponIds.Contains(x.UserCouponId.Value)).ToListAsync(cancellationToken);
                        foreach (var order in orders)
                        {
                            order.UserCouponId = null;
                        }
                    }

                    db.UserCoupons.RemoveRange(userCoupons);
                    db.CouponDefinitions.Remove(definition);

                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "優惠券定義與會員持有紀錄已強制刪除；既有訂單金額仍保留。";
                    return RedirectToAction("Index", "Coupon", new { area = "Store" });
                }

                case "key":
                {
                    var definition = await db.KeyDefinitions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
                    if (definition is null) return NotFound();

                    var keyTransactions = await db.KeyTransactions.Where(x => x.KeyDefinitionId == id).ToListAsync(cancellationToken);
                    var transactionIds = keyTransactions.Select(x => x.Id).ToList();
                    if (transactionIds.Count > 0)
                    {
                        var unlocks = await db.ArtifactUnlocks
                            .Where(x => x.KeyTransactionId.HasValue && transactionIds.Contains(x.KeyTransactionId.Value))
                            .ToListAsync(cancellationToken);
                        db.ArtifactUnlocks.RemoveRange(unlocks);
                    }

                    db.UserKeyBalances.RemoveRange(await db.UserKeyBalances.Where(x => x.KeyDefinitionId == id).ToListAsync(cancellationToken));
                    db.KeyTransactions.RemoveRange(keyTransactions);
                    db.KeyDefinitions.Remove(definition);

                    await db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    TempData["Success"] = "鑰匙定義與相關背包／流水資料已強制刪除。";
                    return RedirectToAction("Index", "Key", new { area = "Catalog" });
                }

                default:
                    return BadRequest("不支援的強制刪除類型。");
            }
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            TempData["Error"] = "強制刪除失敗，仍有未處理的資料關聯。";
            return Redirect(Request.Headers.Referer.ToString());
        }
    }

    private async Task ForceDeleteAnswerAsync(Guid id, CancellationToken cancellationToken)
    {
        var answer = await db.RoundAnswers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (answer is null) throw new InvalidOperationException("Answer not found.");

        db.Votes.RemoveRange(await db.Votes.Where(x => x.AnswerId == id).ToListAsync(cancellationToken));
        db.RoundAnswers.Remove(answer);
    }

    private async Task ForceDeleteRoundAsync(Guid id, CancellationToken cancellationToken)
    {
        var round = await db.GameRounds.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (round is null) throw new InvalidOperationException("Round not found.");

        db.Votes.RemoveRange(await db.Votes.Where(x => x.RoundId == id).ToListAsync(cancellationToken));
        db.RoundAnswers.RemoveRange(await db.RoundAnswers.Where(x => x.RoundId == id).ToListAsync(cancellationToken));
        db.ArtifactUnlocks.RemoveRange(await db.ArtifactUnlocks.Where(x => x.GameRoundId == id).ToListAsync(cancellationToken));
        db.GameRounds.Remove(round);
    }

    private async Task ForceDeletePlayerAsync(Guid id, CancellationToken cancellationToken)
    {
        var player = await db.GamePlayers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (player is null) throw new InvalidOperationException("Player not found.");

        var answers = await db.RoundAnswers.Where(x => x.GamePlayerId == id).ToListAsync(cancellationToken);
        var answerIds = answers.Select(x => x.Id).ToList();

        db.Votes.RemoveRange(await db.Votes
            .Where(x => x.VoterGamePlayerId == id || answerIds.Contains(x.AnswerId))
            .ToListAsync(cancellationToken));
        db.RoundAnswers.RemoveRange(answers);
        db.GamePlayers.Remove(player);
    }

    private async Task ForceDeleteRoomAsync(Guid id, CancellationToken cancellationToken)
    {
        var room = await db.GameRooms.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (room is null) throw new InvalidOperationException("Room not found.");

        var rounds = await db.GameRounds.Where(x => x.RoomId == id).ToListAsync(cancellationToken);
        var roundIds = rounds.Select(x => x.Id).ToList();
        var players = await db.GamePlayers.Where(x => x.RoomId == id).ToListAsync(cancellationToken);
        var playerIds = players.Select(x => x.Id).ToList();

        db.Votes.RemoveRange(await db.Votes.Where(x => roundIds.Contains(x.RoundId) || playerIds.Contains(x.VoterGamePlayerId)).ToListAsync(cancellationToken));
        db.RoundAnswers.RemoveRange(await db.RoundAnswers.Where(x => roundIds.Contains(x.RoundId)).ToListAsync(cancellationToken));
        db.ArtifactUnlocks.RemoveRange(await db.ArtifactUnlocks.Where(x => x.GameRoundId.HasValue && roundIds.Contains(x.GameRoundId.Value)).ToListAsync(cancellationToken));
        db.GameRounds.RemoveRange(rounds);
        db.GamePlayers.RemoveRange(players);
        db.GameRooms.Remove(room);
    }
}
