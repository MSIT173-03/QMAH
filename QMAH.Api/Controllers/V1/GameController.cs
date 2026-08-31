using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/game")]
public sealed class GameController(
    QmahDbContext db,
    IPasswordHasher<GameRoom> passwordHasher) : ApiControllerBase
{
    [AllowAnonymous]
    [HttpGet("rooms")]
    public async Task<ActionResult<ApiPage<GameRoomListItemDto>>> GetRooms(
        string? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.GameRooms
            .AsNoTracking()
            .Where(room => room.Visibility == "PUBLIC");
        status = status?.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status is not ("WAITING" or "PLAYING" or "COMPLETED"))
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "房間狀態無效", detail: "status 只能是 WAITING、PLAYING 或 COMPLETED。");
            query = query.Where(room => room.Status == status);
        }
        else
        {
            query = query.Where(room => room.Status == "WAITING");
        }

        var projected = query
            .OrderByDescending(room => room.CreatedAt)
            .ThenBy(room => room.RoomCode)
            .Select(room => new GameRoomListItemDto(
                room.Id,
                room.RoomCode,
                room.Status,
                room.Visibility,
                room.MaxPlayers,
                room.TotalRounds,
                room.GamePlayers.Count,
                room.CreatedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    [AllowAnonymous]
    [HttpGet("rooms/{id:guid}")]
    public async Task<ActionResult<GameRoomDetailsDto>> GetRoom(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var room = await db.GameRooms
            .AsNoTracking()
            .Include(item => item.GamePlayers)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (room is null || room.Status == "CANCELLED")
            return MissingResource("找不到遊戲房間", "這個房間不存在或已取消。");

        if (room.Visibility == "PRIVATE"
            && (!TryGetCurrentUserId(out var userId)
                || !room.GamePlayers.Any(player => player.UserId == userId)))
        {
            return MissingResource("找不到遊戲房間", "私人房間只對參與者開放。");
        }

        return Ok(ToRoomDto(room));
    }

    [AllowAnonymous]
    [HttpGet("rooms/{id:guid}/history")]
    public async Task<ActionResult<GameRoomHistoryDto>> GetRoomHistory(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var room = await db.GameRooms
            .AsNoTracking()
            .Include(item => item.GamePlayers)
            .Include(item => item.GameRounds)
                .ThenInclude(round => round.Artifact)
            .Include(item => item.GameRounds)
                .ThenInclude(round => round.RoundAnswers)
                    .ThenInclude(answer => answer.GamePlayer)
            .Include(item => item.GameRounds)
                .ThenInclude(round => round.RoundAnswers)
                    .ThenInclude(answer => answer.Votes)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (room is null || room.Status == "CANCELLED")
            return MissingResource("找不到遊戲房間", "這個房間不存在或已取消。");

        if (room.Visibility == "PRIVATE"
            && (!TryGetCurrentUserId(out var userId)
                || !room.GamePlayers.Any(player => player.UserId == userId)))
        {
            return MissingResource("找不到遊戲房間", "私人房間只對參與者開放。");
        }

        var rounds = room.GameRounds
            .OrderBy(round => round.RoundNumber)
            .Select(ToRoundSummary)
            .ToList();
        var leaderboard = BuildLeaderboard(room);
        return Ok(new GameRoomHistoryDto(
            room.Id,
            room.RoomCode,
            room.Status,
            rounds,
            leaderboard));
    }

    [Authorize]
    [HttpPost("rooms")]
    public async Task<ActionResult<GameRoomDetailsDto>> CreateRoom(
        CreateGameRoomRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var visibility = request.Visibility.Trim().ToUpperInvariant();
        if (visibility is not ("PUBLIC" or "PRIVATE"))
            ModelState.AddModelError(nameof(request.Visibility), "Visibility 只能是 PUBLIC 或 PRIVATE。");
        if (visibility == "PRIVATE" && string.IsNullOrWhiteSpace(request.Password))
            ModelState.AddModelError(nameof(request.Password), "私人房間必須設定密碼。");
        if (visibility == "PUBLIC" && !string.IsNullOrWhiteSpace(request.Password))
            ModelState.AddModelError(nameof(request.Password), "公開房間不可設定密碼。");
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();

        var categoryCode = NormalizeOptionalCode(request.CategoryFilterCode);
        if (categoryCode is not null
            && !await db.ArtifactCategories.AnyAsync(
                category => category.Code == categoryCode,
                cancellationToken))
        {
            return MissingResource("找不到文物分類", "房間的分類篩選不存在。");
        }

        var eraCode = NormalizeOptionalCode(request.EraBucketFilterCode);
        if (eraCode is not null
            && !await db.EraBuckets.AnyAsync(era => era.Code == eraCode, cancellationToken))
        {
            return MissingResource("找不到年代篩選", "房間的年代篩選不存在。");
        }

        var room = new GameRoom
        {
            Id = Guid.NewGuid(),
            RoomCode = await GenerateRoomCodeAsync(cancellationToken),
            Status = "WAITING",
            Visibility = visibility,
            PasswordHash = visibility == "PRIVATE"
                ? passwordHasher.HashPassword(null!, request.Password!)
                : null,
            MaxPlayers = request.MaxPlayers,
            TotalRounds = request.TotalRounds,
            AnswerSeconds = request.AnswerSeconds,
            VotingSeconds = request.VotingSeconds,
            CategoryFilterCode = categoryCode,
            EraBucketFilterCode = eraCode,
            CurrentRoundNo = 0,
            StateVersion = 1,
            CreatedAt = DateTime.UtcNow
        };
        room.GamePlayers.Add(new GamePlayer
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            UserId = userId,
            PlayerKey = $"api-host-{room.Id:N}",
            DisplayName = request.DisplayName.Trim(),
            Role = "HOST",
            IsReady = false,
            SeatNo = 1,
            JoinedAt = room.CreatedAt,
            ConnectionStatus = "ONLINE",
            LastSeenAt = room.CreatedAt
        });

        db.GameRooms.Add(room);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetRoom), new { id = room.Id }, ToRoomDto(room));
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/join")]
    public async Task<ActionResult<GameRoomDetailsDto>> JoinRoom(
        Guid id,
        JoinGameRoomRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        if (!await IsActiveUserAsync(userId, cancellationToken))
            return Forbid();

        var room = await db.GameRooms
            .Include(item => item.GamePlayers)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (room is null || room.Status == "CANCELLED")
            return MissingResource("找不到遊戲房間", "這個房間不存在或已取消。");
        var existingPlayer = room.GamePlayers.FirstOrDefault(player => player.UserId == userId);
        if (existingPlayer is not null)
            return Ok(ToRoomDto(room));
        if (room.Status != "WAITING")
            return InvalidWorkflow("房間目前不可加入", "只有等待中的房間可以加入。");
        if (room.GamePlayers.Count >= room.MaxPlayers)
            return InvalidWorkflow("房間已額滿", "請選擇其他等待中的房間。");
        if (room.Visibility == "PRIVATE")
        {
            var verification = passwordHasher.VerifyHashedPassword(
                room,
                room.PasswordHash ?? "",
                request.Password ?? "");
            if (verification == PasswordVerificationResult.Failed)
                return Problem(statusCode: StatusCodes.Status403Forbidden, title: "房間密碼錯誤", detail: "無法加入私人房間。");
        }

        var usedSeats = room.GamePlayers
            .Where(player => player.SeatNo.HasValue)
            .Select(player => player.SeatNo!.Value)
            .ToHashSet();
        var seat = Enumerable.Range(1, room.MaxPlayers)
            .Select(value => (byte)value)
            .First(value => !usedSeats.Contains(value));
        var now = DateTime.UtcNow;
        room.GamePlayers.Add(new GamePlayer
        {
            Id = Guid.NewGuid(),
            RoomId = room.Id,
            UserId = userId,
            PlayerKey = $"api-player-{room.Id:N}-{userId:N}",
            DisplayName = request.DisplayName.Trim(),
            Role = "PLAYER",
            IsReady = false,
            SeatNo = seat,
            JoinedAt = now,
            ConnectionStatus = "ONLINE",
            LastSeenAt = now
        });
        room.StateVersion++;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToRoomDto(room));
    }

    [Authorize]
    [HttpPost("rounds/{id:guid}/answers")]
    public async Task<ActionResult<GameAnswerDto>> SubmitAnswer(
        Guid id,
        SubmitAnswerRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);
        var answerType = request.AnswerType.Trim().ToUpperInvariant();
        if (answerType is not ("CREATIVE_TALE" or "PLAUSIBLE_FICTION" or "FACTUAL_REASONING"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "回答類型無效", detail: "AnswerType 不符合遊戲規則。");

        var round = await db.GameRounds
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (round is null)
            return MissingResource("找不到遊戲回合", "這個回合不存在。");
        if (round.Status != "ANSWERING" || round.AnswerDeadlineAt < DateTime.UtcNow)
            return InvalidWorkflow("目前不是回答階段", "只有回答中的回合可以送出回答。");

        var player = await db.GamePlayers
            .SingleOrDefaultAsync(item => item.Id != Guid.Empty
                && item.RoomId == round.RoomId
                && item.UserId == userId
                && item.ConnectionStatus != "LEFT", cancellationToken);
        if (player is null)
            return Forbid();
        if (await db.RoundAnswers.AnyAsync(
                answer => answer.RoundId == id && answer.GamePlayerId == player.Id,
                cancellationToken))
        {
            return InvalidWorkflow("回答已送出", "同一位玩家在同一回合只能送出一次回答。");
        }

        var answer = new RoundAnswer
        {
            Id = Guid.NewGuid(),
            RoundId = id,
            GamePlayerId = player.Id,
            AnswerType = answerType,
            Text = request.Text.Trim(),
            SubmittedAt = DateTime.UtcNow
        };
        db.RoundAnswers.Add(answer);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new GameAnswerDto(
            answer.Id,
            answer.GamePlayerId,
            player.DisplayName,
            answer.AnswerType,
            answer.Text,
            0,
            0,
            false,
            answer.SubmittedAt));
    }

    [Authorize]
    [HttpPost("rounds/{id:guid}/votes")]
    public async Task<ActionResult> SubmitVote(
        Guid id,
        SubmitVoteRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var round = await db.GameRounds
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (round is null)
            return MissingResource("找不到遊戲回合", "這個回合不存在。");
        if (round.Status != "VOTING" || round.VotingDeadlineAt < DateTime.UtcNow)
            return InvalidWorkflow("目前不是投票階段", "只有投票中的回合可以投票。");

        var voter = await db.GamePlayers
            .SingleOrDefaultAsync(item => item.RoomId == round.RoomId
                && item.UserId == userId
                && item.ConnectionStatus != "LEFT", cancellationToken);
        if (voter is null)
            return Forbid();
        var answer = await db.RoundAnswers
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == request.AnswerId && item.RoundId == id, cancellationToken);
        if (answer is null)
            return MissingResource("找不到回答", "投票目標不屬於這個回合。");
        if (answer.GamePlayerId == voter.Id)
            return InvalidWorkflow("不能投給自己的回答", "請選擇其他玩家的回答。");
        if (await db.Votes.AnyAsync(
                vote => vote.RoundId == id
                    && vote.VoterGamePlayerId == voter.Id
                    && vote.AnswerId == answer.Id,
                cancellationToken))
        {
            return InvalidWorkflow("投票已送出", "同一位玩家不能重複投給同一個回答。");
        }

        db.Votes.Add(new Vote
        {
            Id = Guid.NewGuid(),
            RoundId = id,
            VoterGamePlayerId = voter.Id,
            AnswerId = answer.Id,
            Count = request.Count,
            SubmittedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        return Accepted();
    }

    [Authorize]
    [HttpGet("rounds/{id:guid}")]
    public async Task<ActionResult<GameRoundDetailsDto>> GetRound(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var round = await db.GameRounds
            .AsNoTracking()
            .Include(item => item.Room)
                .ThenInclude(room => room.GamePlayers)
            .Include(item => item.Artifact)
            .Include(item => item.RoundAnswers)
                .ThenInclude(answer => answer.GamePlayer)
            .Include(item => item.RoundAnswers)
                .ThenInclude(answer => answer.Votes)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (round is null)
            return MissingResource("找不到遊戲回合", "這個回合不存在。");
        if (round.Room.Visibility == "PRIVATE"
            && (!TryGetCurrentUserId(out var userId)
                || !await db.GamePlayers.AnyAsync(
                    player => player.RoomId == round.RoomId && player.UserId == userId,
                    cancellationToken)))
        {
            return Forbid();
        }

        return Ok(ToRoundDetailsDto(round));
    }

    private async Task<bool> IsActiveUserAsync(Guid userId, CancellationToken cancellationToken) =>
        await db.Users.AnyAsync(user => user.Id == userId && user.Status == "ACTIVE", cancellationToken);

    private async Task<string> GenerateRoomCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            if (!await db.GameRooms.AnyAsync(room => room.RoomCode == code, cancellationToken))
                return code;
        }

        throw new InvalidOperationException("目前無法產生唯一的房間代碼，請稍後再試。");
    }

    private static GameRoomDetailsDto ToRoomDto(GameRoom room) => new(
        room.Id,
        room.RoomCode,
        room.Status,
        room.Visibility,
        room.MaxPlayers,
        room.TotalRounds,
        room.AnswerSeconds,
        room.VotingSeconds,
        room.CategoryFilterCode,
        room.EraBucketFilterCode,
        room.CurrentRoundNo,
        room.GamePlayers
            .OrderBy(player => player.SeatNo)
            .ThenBy(player => player.JoinedAt)
            .Select(player => new GamePlayerDto(
                player.Id,
                player.DisplayName,
                player.Role,
                player.IsReady,
                player.SeatNo,
                player.ConnectionStatus))
            .ToList(),
        room.CreatedAt,
        room.StartedAt,
        room.EndedAt);

    private static GameRoundDetailsDto ToRoundDetailsDto(GameRound round)
    {
        var answerRows = BuildRankedAnswers(round);
        var winner = GetWinner(answerRows, round.IsSettled);
        return new GameRoundDetailsDto(
            round.Id,
            round.RoomId,
            round.ArtifactId,
            round.Artifact.Name,
            round.RoundNumber,
            round.Status,
            round.IsSettled,
            round.StartedAt,
            round.AnswerDeadlineAt,
            round.VotingDeadlineAt,
            round.SettledAt,
            round.Room.GamePlayers.Count,
            answerRows.Sum(row => row.VoteCount),
            winner?.Answer.Id,
            winner?.Answer.GamePlayer.DisplayName,
            answerRows.Select((row, index) => new GameAnswerDto(
                row.Answer.Id,
                row.Answer.GamePlayerId,
                row.Answer.GamePlayer.DisplayName,
                row.Answer.AnswerType,
                row.Answer.Text,
                row.VoteCount,
                index + 1,
                winner?.Answer.Id == row.Answer.Id,
                row.Answer.SubmittedAt)).ToList());
    }

    private static GameRoundSummaryDto ToRoundSummary(GameRound round)
    {
        var answerRows = BuildRankedAnswers(round);
        var winner = GetWinner(answerRows, round.IsSettled);
        return new GameRoundSummaryDto(
            round.Id,
            round.RoundNumber,
            round.ArtifactId,
            round.Artifact.Name,
            round.Status,
            round.IsSettled,
            round.StartedAt,
            round.SettledAt,
            answerRows.Count,
            answerRows.Sum(row => row.VoteCount),
            winner?.Answer.Id,
            winner?.Answer.GamePlayer.DisplayName,
            answerRows.Select((row, index) => new GameAnswerDto(
                row.Answer.Id,
                row.Answer.GamePlayerId,
                row.Answer.GamePlayer.DisplayName,
                row.Answer.AnswerType,
                row.Answer.Text,
                row.VoteCount,
                index + 1,
                winner?.Answer.Id == row.Answer.Id,
                row.Answer.SubmittedAt)).ToList());
    }

    private static IReadOnlyList<GameLeaderboardItemDto> BuildLeaderboard(GameRoom room)
    {
        var rows = room.GamePlayers
            .Select(player =>
            {
                var answers = room.GameRounds
                    .SelectMany(round => round.RoundAnswers)
                    .Where(answer => answer.GamePlayerId == player.Id)
                    .ToList();
                var roundsWon = room.GameRounds
                    .Count(round => GetWinner(BuildRankedAnswers(round), round.IsSettled)?.Answer.GamePlayerId == player.Id);
                return new
                {
                    player.Id,
                    player.DisplayName,
                    Score = answers.Sum(answer => answer.Votes.Sum(vote => vote.Count)),
                    RoundsAnswered = answers.Count,
                    RoundsWon = roundsWon
                };
            })
            .OrderByDescending(row => row.Score)
            .ThenByDescending(row => row.RoundsWon)
            .ThenByDescending(row => row.RoundsAnswered)
            .ThenBy(row => row.DisplayName, StringComparer.Ordinal)
            .ToList();

        return rows
            .Select((row, index) => new GameLeaderboardItemDto(
                row.Id,
                row.DisplayName,
                row.Score,
                row.RoundsAnswered,
                row.RoundsWon,
                index + 1))
            .ToList();
    }

    private static List<RankedAnswer> BuildRankedAnswers(GameRound round) =>
        round.RoundAnswers
            .Select(answer => new RankedAnswer(answer, answer.Votes.Sum(vote => vote.Count)))
            .OrderByDescending(row => row.VoteCount)
            .ThenBy(row => row.Answer.SubmittedAt)
            .ThenBy(row => row.Answer.Id)
            .ToList();

    private static RankedAnswer? GetWinner(
        IReadOnlyList<RankedAnswer> answers,
        bool isSettled) =>
        isSettled && answers.Count > 0 && answers[0].VoteCount > 0
            ? answers[0]
            : null;

    private sealed record RankedAnswer(RoundAnswer Answer, int VoteCount);

    private static string? NormalizeOptionalCode(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
