using System.Data;
using System.Security.Cryptography;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Infrastructure.Services.Game;

public enum GameRoomMutationStatus
{
    Success,
    NotFound,
    Forbidden,
    Conflict,
    QuestionsUnavailable
}

public sealed record GameRoomMutationResult(GameRoomMutationStatus Status, GameRoom? Room = null)
{
    public bool Succeeded => Status == GameRoomMutationStatus.Success;
}

public sealed class GameRoomLifecycleService(
    QmahDbContext db,
    IPasswordHasher<GameRoom> passwordHasher,
    IGameRoomNotifier? notifier = null)
{
    // integration: 所有房間狀態變更與背景推進都走同一個 service；時間常數集中在此，
    // 方便未來依部署負載調整，而不讓 Controller、Worker 各自維護一套逾時規則。
    private static readonly TimeSpan PresenceTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan ReconnectWindow = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan RevealDuration = TimeSpan.FromSeconds(8);

    public Task<GameRoomMutationResult> JoinAsync(
        Guid roomId,
        Guid userId,
        string displayName,
        string? password,
        CancellationToken cancellationToken = default) =>
        InTransactionAsync(async token =>
        {
            if (!await IsActiveUserAsync(userId, token))
                return Result(GameRoomMutationStatus.Forbidden);

            var room = await db.GameRooms
                .Include(item => item.GamePlayers)
                .SingleOrDefaultAsync(item => item.Id == roomId, token);
            if (room is null || room.Status == "CANCELLED")
                return Result(GameRoomMutationStatus.NotFound);

            var now = DateTime.UtcNow;
            var existingPlayer = room.GamePlayers.SingleOrDefault(player => player.UserId == userId);
            if (existingPlayer is not null)
            {
                if (existingPlayer.ConnectionStatus == "LEFT"
                    && room.Status != "WAITING")
                {
                    return Result(GameRoomMutationStatus.Conflict);
                }

                if (existingPlayer.ConnectionStatus == "OFFLINE"
                    && existingPlayer.ReconnectDeadlineAt <= now
                    && room.Status != "WAITING")
                {
                    return Result(GameRoomMutationStatus.Conflict);
                }

                if (room.Status is not ("WAITING" or "PLAYING"))
                    return Result(GameRoomMutationStatus.Conflict);

                if (existingPlayer.ConnectionStatus == "LEFT")
                {
                    existingPlayer.SeatNo = FindAvailableSeat(room);
                    existingPlayer.IsReady = false;
                }

                existingPlayer.ConnectionStatus = "ONLINE";
                existingPlayer.LastSeenAt = now;
                existingPlayer.DisconnectedAt = null;
                existingPlayer.ReconnectDeadlineAt = null;
                existingPlayer.LeftAt = null;
                existingPlayer.DisplayName = displayName.Trim();
                room.StateVersion++;
                return Result(GameRoomMutationStatus.Success, room);
            }

            if (room.Status != "WAITING")
                return Result(GameRoomMutationStatus.Conflict);

            var activePlayers = room.GamePlayers
                .Where(player => player.ConnectionStatus != "LEFT")
                .ToList();
            if (activePlayers.Count >= room.MaxPlayers)
                return Result(GameRoomMutationStatus.Conflict);

            if (room.Visibility == "PRIVATE")
            {
                var verification = passwordHasher.VerifyHashedPassword(
                    room,
                    room.PasswordHash ?? "",
                    password ?? "");
                if (verification == PasswordVerificationResult.Failed)
                    return Result(GameRoomMutationStatus.Forbidden);
            }

            room.GamePlayers.Add(new GamePlayer
            {
                Id = Guid.NewGuid(),
                RoomId = room.Id,
                UserId = userId,
                PlayerKey = $"api-player-{room.Id:N}-{userId:N}",
                DisplayName = displayName.Trim(),
                Role = "PLAYER",
                IsReady = false,
                SeatNo = FindAvailableSeat(room),
                JoinedAt = now,
                ConnectionStatus = "ONLINE",
                LastSeenAt = now
            });
            room.StateVersion++;
            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    public Task<GameRoomMutationResult> SetReadyAsync(
        Guid roomId,
        Guid userId,
        bool isReady,
        CancellationToken cancellationToken = default) =>
        InTransactionAsync(async token =>
        {
            if (!await IsActiveUserAsync(userId, token))
                return Result(GameRoomMutationStatus.Forbidden);

            var room = await LoadRoomAsync(roomId, token);
            if (room is null || room.Status == "CANCELLED")
                return Result(GameRoomMutationStatus.NotFound);
            if (room.Status != "WAITING")
                return Result(GameRoomMutationStatus.Conflict);

            var player = room.GamePlayers.SingleOrDefault(item =>
                item.UserId == userId && item.ConnectionStatus != "LEFT");
            if (player is null)
                return Result(GameRoomMutationStatus.Forbidden);

            MarkOnline(player, DateTime.UtcNow);
            player.IsReady = isReady;
            room.StateVersion++;
            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    public Task<GameRoomMutationResult> StartAsync(
        Guid roomId,
        Guid userId,
        CancellationToken cancellationToken = default) =>
        InTransactionAsync(async token =>
        {
            if (!await IsActiveUserAsync(userId, token))
                return Result(GameRoomMutationStatus.Forbidden);

            var room = await LoadRoomAsync(roomId, token);
            if (room is null || room.Status == "CANCELLED")
                return Result(GameRoomMutationStatus.NotFound);
            if (room.Status != "WAITING")
                return Result(GameRoomMutationStatus.Conflict);

            var players = room.GamePlayers.Where(player => player.ConnectionStatus != "LEFT").ToList();
            if (!players.Any(player => player.UserId == userId && player.Role == "HOST"))
                return Result(GameRoomMutationStatus.Forbidden);
            if (players.Count < 2 || players.Any(player => player.ConnectionStatus != "ONLINE" || !player.IsReady))
                return Result(GameRoomMutationStatus.Conflict);

            var artifactIds = await GetEligibleArtifactIdsAsync(room, token);
            if (artifactIds.Count < room.TotalRounds)
                return Result(GameRoomMutationStatus.QuestionsUnavailable);
            Shuffle(artifactIds);

            var now = DateTime.UtcNow;
            room.Status = "PLAYING";
            room.StartedAt = now;
            room.CurrentRoundNo = 1;
            room.StateVersion++;
            room.GameRounds.Add(CreateRound(room, artifactIds[0], 1, now));
            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    public Task<GameRoomMutationResult> LeaveAsync(
        Guid roomId,
        Guid userId,
        CancellationToken cancellationToken = default) =>
        InTransactionAsync(async token =>
        {
            if (!await IsActiveUserAsync(userId, token))
                return Result(GameRoomMutationStatus.Forbidden);

            var room = await LoadRoomAsync(roomId, token);
            if (room is null)
                return Result(GameRoomMutationStatus.NotFound);

            var player = room.GamePlayers.SingleOrDefault(item => item.UserId == userId);
            if (player is null)
                return Result(GameRoomMutationStatus.Forbidden);
            if (player.ConnectionStatus == "LEFT")
                return Result(GameRoomMutationStatus.Success, room);
            if (room.Status == "COMPLETED")
            {
                MarkLeft(player, DateTime.UtcNow);
                room.StateVersion++;
                return Result(GameRoomMutationStatus.Success, room);
            }
            if (room.Status is not ("WAITING" or "PLAYING"))
                return Result(GameRoomMutationStatus.Conflict);

            var now = DateTime.UtcNow;
            var wasWaitingHost = room.Status == "WAITING" && player.Role == "HOST";
            MarkLeft(player, now);
            room.StateVersion++;

            var remainingPlayers = room.GamePlayers
                .Where(item => item.Id != player.Id && item.ConnectionStatus != "LEFT")
                .OrderBy(item => item.JoinedAt)
                .ThenBy(item => item.Id)
                .ToList();

            if (wasWaitingHost && remainingPlayers.Count > 0)
            {
                player.Role = "PLAYER";
                await db.SaveChangesAsync(token);
                remainingPlayers[0].Role = "HOST";
            }
            else if (remainingPlayers.Count == 0)
            {
                if (room.Status == "WAITING")
                {
                    CancelRoom(room, now);
                }
                else
                {
                    CompleteRoom(room, room.GameRounds
                        .OrderByDescending(round => round.RoundNumber)
                        .FirstOrDefault(), DateTime.UtcNow);
                }
            }

            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    public Task<GameRoomMutationResult> HeartbeatAsync(
        Guid roomId,
        Guid userId,
        CancellationToken cancellationToken = default) =>
        InTransactionAsync(async token =>
        {
            if (!await IsActiveUserAsync(userId, token))
                return Result(GameRoomMutationStatus.Forbidden);

            var room = await LoadRoomAsync(roomId, token);
            if (room is null || room.Status is "CANCELLED" or "COMPLETED")
                return Result(GameRoomMutationStatus.NotFound);

            var player = room.GamePlayers.SingleOrDefault(item => item.UserId == userId);
            if (player is null || player.ConnectionStatus == "LEFT")
                return Result(GameRoomMutationStatus.Forbidden);

            var now = DateTime.UtcNow;
            if (player.ConnectionStatus == "OFFLINE" && player.ReconnectDeadlineAt <= now)
                return Result(GameRoomMutationStatus.Conflict);

            MarkOnline(player, now);
            room.StateVersion++;
            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    public async Task ProcessExpiredPresenceAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var staleIds = await db.GamePlayers.AsNoTracking()
            .Where(player => player.ConnectionStatus == "ONLINE"
                && player.LastSeenAt <= now - PresenceTimeout
                && (player.Room.Status == "WAITING" || player.Room.Status == "PLAYING"))
            .OrderBy(player => player.LastSeenAt)
            .Select(player => player.Id)
            .Take(100)
            .ToListAsync(cancellationToken);

        foreach (var playerId in staleIds)
            await ChangePresenceAsync(playerId, offline: true, cancellationToken);

        var expiredIds = await db.GamePlayers.AsNoTracking()
            .Where(player => player.ConnectionStatus == "OFFLINE"
                && player.ReconnectDeadlineAt <= now
                && (player.Room.Status == "WAITING" || player.Room.Status == "PLAYING"))
            .OrderBy(player => player.ReconnectDeadlineAt)
            .Select(player => player.Id)
            .Take(100)
            .ToListAsync(cancellationToken);

        foreach (var playerId in expiredIds)
            await ChangePresenceAsync(playerId, offline: false, cancellationToken);
    }

    public async Task ProcessDueGamesAsync(CancellationToken cancellationToken = default)
    {
        var roundIds = await db.GameRounds.AsNoTracking()
            .Where(round => round.Room.Status == "PLAYING"
                && round.RoundNumber == round.Room.CurrentRoundNo
                && (round.Status == "ANSWERING" || round.Status == "VOTING" || round.Status == "REVEALED"))
            .OrderBy(round => round.RoomId)
            .ThenBy(round => round.RoundNumber)
            .Select(round => round.Id)
            .ToListAsync(cancellationToken);

        foreach (var roundId in roundIds)
        {
            try
            {
                await AdvanceRoundAsync(roundId, cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private Task<GameRoomMutationResult> AdvanceRoundAsync(
        Guid roundId,
        CancellationToken cancellationToken) =>
        InTransactionAsync(async token =>
        {
            var round = await db.GameRounds
                .Include(item => item.Room)
                    .ThenInclude(room => room.GamePlayers)
                .Include(item => item.Room)
                    .ThenInclude(room => room.GameRounds)
                .Include(item => item.RoundAnswers)
                .SingleOrDefaultAsync(item => item.Id == roundId, token);
            if (round is null || round.Room.Status != "PLAYING")
                return Result(GameRoomMutationStatus.Success);

            var now = DateTime.UtcNow;
            var room = round.Room;
            var activePlayers = room.GamePlayers
                .Where(player => player.ConnectionStatus != "LEFT")
                .ToList();
            if (activePlayers.Count == 0)
            {
                CompleteRoom(room, round, now);
                return Result(GameRoomMutationStatus.Success, room);
            }

            if (round.Status == "ANSWERING")
            {
                var allAnswered = activePlayers.All(player =>
                    round.RoundAnswers.Any(answer => answer.GamePlayerId == player.Id));
                if (allAnswered || round.AnswerDeadlineAt <= now)
                {
                    round.Status = "VOTING";
                    round.VotingDeadlineAt = now.AddSeconds(room.VotingSeconds);
                    round.StateVersion++;
                    room.StateVersion++;
                }
            }
            else if (round.Status == "VOTING")
            {
                var votes = await db.Votes.AsNoTracking().Where(vote => vote.RoundId == round.Id)
                    .Select(vote => new { vote.VoterGamePlayerId, vote.Answer.AnswerType }).ToListAsync(token);
                var allVoted = activePlayers.All(player => round.RoundAnswers
                    .Where(answer => answer.GamePlayerId != player.Id).Select(answer => answer.AnswerType).Distinct()
                    .All(type => votes.Any(vote => vote.VoterGamePlayerId == player.Id && vote.AnswerType == type)));
                if (allVoted || round.VotingDeadlineAt <= now)
                {
                    round.Status = "REVEALED";
                    round.IsSettled = true;
                    round.SettledAt = now;
                    round.StateVersion++;
                    room.StateVersion++;
                }
            }
            else if (round.Status == "REVEALED"
                && round.SettledAt is { } settledAt
                && settledAt <= now - RevealDuration)
            {
                if (round.RoundNumber >= room.TotalRounds)
                {
                    CompleteRoom(room, round, now);
                }
                else
                {
                    var usedArtifactIds = room.GameRounds
                        .Select(item => item.ArtifactId)
                        .ToHashSet();
                    var availableArtifactIds = await GetEligibleArtifactIdsAsync(room, token);
                    availableArtifactIds.RemoveAll(usedArtifactIds.Contains);
                    if (availableArtifactIds.Count == 0)
                    {
                        CompleteRoom(room, round, now);
                    }
                    else
                    {
                        Shuffle(availableArtifactIds);
                        room.CurrentRoundNo = (byte)(round.RoundNumber + 1);
                        room.StateVersion++;
                        room.GameRounds.Add(CreateRound(
                            room,
                            availableArtifactIds[0],
                            round.RoundNumber + 1,
                            now));
                    }
                }
            }

            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);

    private async Task ChangePresenceAsync(Guid playerId, bool offline, CancellationToken cancellationToken)
    {
        await InTransactionAsync(async token =>
        {
            var player = await db.GamePlayers
                .Include(item => item.Room)
                    .ThenInclude(room => room.GamePlayers)
                .Include(item => item.Room)
                    .ThenInclude(room => room.GameRounds)
                .SingleOrDefaultAsync(item => item.Id == playerId, token);
            if (player is null || player.ConnectionStatus == "LEFT"
                || player.Room.Status is not ("WAITING" or "PLAYING"))
            {
                return Result(GameRoomMutationStatus.Success);
            }

            var now = DateTime.UtcNow;
            var room = player.Room;
            if (offline)
            {
                if (player.ConnectionStatus != "ONLINE" || player.LastSeenAt > now - PresenceTimeout)
                    return Result(GameRoomMutationStatus.Success);

                player.ConnectionStatus = "OFFLINE";
                player.DisconnectedAt = now;
                player.ReconnectDeadlineAt = now + ReconnectWindow;
                if (room.Status == "WAITING")
                    player.IsReady = false;
            }
            else
            {
                if (player.ConnectionStatus != "OFFLINE" || player.ReconnectDeadlineAt > now)
                    return Result(GameRoomMutationStatus.Success);

                MarkLeft(player, now);
                if (room.Status == "WAITING" && player.Role == "HOST")
                {
                    var nextHost = room.GamePlayers
                        .Where(item => item.Id != player.Id && item.ConnectionStatus != "LEFT")
                        .OrderBy(item => item.JoinedAt)
                        .ThenBy(item => item.Id)
                        .FirstOrDefault();
                    if (nextHost is not null)
                    {
                        player.Role = "PLAYER";
                        await db.SaveChangesAsync(token);
                        nextHost.Role = "HOST";
                    }
                }

                var activePlayers = room.GamePlayers.Count(item => item.ConnectionStatus != "LEFT");
                if (activePlayers == 0)
                {
                    if (room.Status == "WAITING")
                    {
                        CancelRoom(room, now);
                    }
                    else
                    {
                        CompleteRoom(room, room.GameRounds
                            .OrderByDescending(round => round.RoundNumber)
                            .FirstOrDefault(), now);
                    }
                }
            }

            room.StateVersion++;
            return Result(GameRoomMutationStatus.Success, room);
        }, cancellationToken);
    }

    private async Task<List<Guid>> GetEligibleArtifactIdsAsync(
        GameRoom room,
        CancellationToken cancellationToken) =>
        await db.ArtifactQuestionEntries.AsNoTracking()
            .Where(entry => entry.IsEnabled
                && entry.Artifact.IsActive
                && (room.CategoryFilterCode == null
                    || entry.Artifact.Category.Code == room.CategoryFilterCode)
                && (room.EraBucketFilterCode == null
                    || entry.Artifact.EraBucket.Code == room.EraBucketFilterCode))
            .Select(entry => entry.ArtifactId)
            .Distinct()
            .ToListAsync(cancellationToken);

    private static GameRound CreateRound(GameRoom room, Guid artifactId, int roundNumber, DateTime now)
    {
        room.AnswerSeconds = (short)Math.Clamp((int)room.AnswerSeconds, 120, 300);
        room.VotingSeconds = (short)Math.Clamp((int)room.VotingSeconds, 120, 300);
        var answerDeadlineAt = now.AddSeconds(room.AnswerSeconds);
        return new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            ArtifactId = artifactId,
            RoundNumber = roundNumber,
            Status = "ANSWERING",
            StateVersion = 1,
            IsSettled = false,
            StartedAt = now,
            AnswerDeadlineAt = answerDeadlineAt,
            VotingDeadlineAt = answerDeadlineAt.AddSeconds(room.VotingSeconds)
        };
    }

    private async Task<GameRoom?> LoadRoomAsync(Guid roomId, CancellationToken cancellationToken) =>
        await db.GameRooms
            .Include(item => item.GamePlayers)
            .Include(item => item.GameRounds)
            .SingleOrDefaultAsync(item => item.Id == roomId, cancellationToken);

    private async Task<bool> IsActiveUserAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken);

    private async Task<GameRoomMutationResult> InTransactionAsync(
        Func<CancellationToken, Task<GameRoomMutationResult>> operation,
        CancellationToken cancellationToken)
    {
        // integration: Serializable + execution strategy 要包住完整 mutation；
        // 房間人數、座位與回合狀態不能在 SQL retry 時只完成一半。
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async retryToken =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable,
                    retryToken);
                var result = await operation(retryToken);
                if (!result.Succeeded)
                    return result;

                var changedRooms = CollectChangedRooms();
                await db.SaveChangesAsync(retryToken);
                await transaction.CommitAsync(retryToken);
                // 提交成功後才通知，客戶端重新讀取時一定看得到新狀態。
                foreach (var roomId in changedRooms)
                    notifier?.Changed(roomId);
                return result;
            }, cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return Result(GameRoomMutationStatus.Conflict);
        }
    }

    /// <summary>
    /// 從 ChangeTracker 找出有實質變動的房間。心跳只會更新 LastSeenAt 與 StateVersion，
    /// 這種每 15 秒一次的更新不通知，否則人一多就變成推播風暴。
    /// </summary>
    private HashSet<Guid> CollectChangedRooms()
    {
        var rooms = new HashSet<Guid>();
        if (notifier is null)
            return rooms;

        foreach (var entry in db.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                continue;
            if (entry.State == EntityState.Modified)
            {
                var ignored = entry.Entity switch
                {
                    GameRoom => new[] { nameof(GameRoom.StateVersion) },
                    GamePlayer => new[] { nameof(GamePlayer.LastSeenAt) },
                    _ => Array.Empty<string>()
                };
                if (!entry.Properties.Any(property => property.IsModified && !ignored.Contains(property.Metadata.Name)))
                    continue;
            }

            switch (entry.Entity)
            {
                case GameRoom room: rooms.Add(room.Id); break;
                case GamePlayer player: rooms.Add(player.RoomId); break;
                case GameRound round: rooms.Add(round.RoomId); break;
            }
        }

        return rooms;
    }

    private static void MarkOnline(GamePlayer player, DateTime now)
    {
        player.ConnectionStatus = "ONLINE";
        player.LastSeenAt = now;
        player.DisconnectedAt = null;
        player.ReconnectDeadlineAt = null;
        player.LeftAt = null;
    }

    private static void MarkLeft(GamePlayer player, DateTime now)
    {
        player.ConnectionStatus = "LEFT";
        player.IsReady = false;
        player.SeatNo = null;
        player.DisconnectedAt = null;
        player.ReconnectDeadlineAt = null;
        player.LeftAt = now;
    }

    private static byte FindAvailableSeat(GameRoom room)
    {
        var usedSeats = room.GamePlayers
            .Where(player => player.ConnectionStatus != "LEFT" && player.SeatNo.HasValue)
            .Select(player => player.SeatNo!.Value)
            .ToHashSet();
        return Enumerable.Range(1, room.MaxPlayers)
            .Select(value => (byte)value)
            .First(seat => !usedSeats.Contains(seat));
    }

    private static void CompleteRoom(GameRoom room, GameRound? round, DateTime now)
    {
        if (round is not null && round.Status is "ANSWERING" or "VOTING")
        {
            round.Status = "REVEALED";
            round.IsSettled = true;
            round.SettledAt = now;
            round.StateVersion++;
        }

        room.Status = "COMPLETED";
        room.EndedAt = now;
        room.CompletedAt = now;
        room.StateVersion++;
    }

    private static void CancelRoom(GameRoom room, DateTime now)
    {
        // game-lifecycle: 取消也是已終止狀態，兩個時間欄位一起寫入才能符合資料庫約束。
        room.Status = "CANCELLED";
        room.EndedAt = now;
        room.CompletedAt = now;
    }

    private static void Shuffle<T>(IList<T> values)
    {
        for (var index = values.Count - 1; index > 0; index--)
        {
            var swapIndex = RandomNumberGenerator.GetInt32(index + 1);
            (values[index], values[swapIndex]) = (values[swapIndex], values[index]);
        }
    }

    private static GameRoomMutationResult Result(
        GameRoomMutationStatus status,
        GameRoom? room = null) => new(status, room);
}
