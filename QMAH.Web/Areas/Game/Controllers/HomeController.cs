using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Infrastructure.Data;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public sealed class HomeController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var questionStats = await db.ArtifactQuestionEntries
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalCount = group.Count(),
                EnabledCount = group.Count(entry => entry.IsEnabled)
            })
            .SingleOrDefaultAsync(cancellationToken);

        var roomCounts = await db.GameRooms
            .AsNoTracking()
            .GroupBy(room => room.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Status, item => item.Count, cancellationToken);

        var model = new GameDashboardViewModel
        {
            EnabledQuestionCount = questionStats?.EnabledCount ?? 0,
            TotalQuestionCount = questionStats?.TotalCount ?? 0,
            WaitingRoomCount = roomCounts.GetValueOrDefault("WAITING"),
            PlayingRoomCount = roomCounts.GetValueOrDefault("PLAYING"),
            CompletedRoomCount = roomCounts.GetValueOrDefault("COMPLETED"),
            OnlinePlayerCount = await db.GamePlayers
                .AsNoTracking()
                .CountAsync(x => x.ConnectionStatus == "ONLINE", cancellationToken),
            RoundCount = await db.GameRounds.AsNoTracking().CountAsync(cancellationToken),
            AnswerCount = await db.RoundAnswers.AsNoTracking().CountAsync(cancellationToken),
            VoteCount = await db.Votes.AsNoTracking().CountAsync(cancellationToken),
            RecentRooms = await db.GameRooms
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(8)
                .Select(x => new DashboardRoomItemViewModel
                {
                    Id = x.Id,
                    RoomCode = x.RoomCode,
                    Status = x.Status,
                    Visibility = x.Visibility,
                    PlayerCount = x.GamePlayers.Count,
                    RoundCount = x.GameRounds.Count,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken),
            RecentRounds = await db.GameRounds
                .AsNoTracking()
                .OrderByDescending(x => x.StartedAt)
                .Take(6)
                .Select(x => new DashboardRoundItemViewModel
                {
                    Id = x.Id,
                    RoomCode = x.Room.RoomCode,
                    RoundNumber = x.RoundNumber,
                    ArtifactName = x.Artifact.Name,
                    Status = x.Status,
                    StartedAt = x.StartedAt
                })
                .ToListAsync(cancellationToken),
            RecentPlayers = await db.GamePlayers
                .AsNoTracking()
                .OrderByDescending(x => x.LastSeenAt)
                .Take(6)
                .Select(x => new DashboardPlayerItemViewModel
                {
                    Id = x.Id,
                    RoomCode = x.Room.RoomCode,
                    DisplayName = x.DisplayName,
                    ConnectionStatus = x.ConnectionStatus,
                    JoinedAt = x.JoinedAt
                })
                .ToListAsync(cancellationToken),
            DifficultyDistribution = await db.ArtifactQuestionEntries
                .AsNoTracking()
                .GroupBy(x => x.Difficulty)
                .OrderBy(x => x.Key)
                .Select(x => new DashboardDifficultyItemViewModel
                {
                    Difficulty = x.Key,
                    Count = x.Count(),
                    EnabledCount = x.Count(entry => entry.IsEnabled)
                })
                .ToListAsync(cancellationToken)
        };

        return View(model);
    }
}
