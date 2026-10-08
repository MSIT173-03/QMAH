using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using System.Data;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Game;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/game")]
// integration: Controller 只負責登入／輸入與 HTTP 結果轉換；房間狀態遷移集中在
// GameRoomLifecycleService，讓 HTTP 請求與背景 worker 使用同一套交易規則，後續部署到多台主機時也不分叉。
public sealed class GameController(
    QmahDbContext db,
    IPasswordHasher<GameRoom> passwordHasher,
    GameRoomLifecycleService gameRoomLifecycleService,
    IGameRoomNotifier roomNotifier,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    [Authorize(Roles = "Admin")]
    [HttpGet("rehearsal-rooms")]
    public ActionResult<ApiPage<GameRehearsalRoomDto>> GetRehearsalRooms(string? status, string? sort, int page = 1, int pageSize = 20, string? roomCode = null)
    {
        if (page<1 || pageSize is <1 or >100) return Problem(statusCode: 400, title: "分頁設定無效");
        roomCode = roomCode?.Trim().ToUpperInvariant();
        if (roomCode?.Length > 16) return Problem(statusCode: 400, title: "房號過長");
        // 房卡只是同一演練流程的展示設定，不建立實體房間或背景計時器。
        int[] answerTimes = [120, 150, 180, 240, 300];
        int[] votingTimes = [120, 150, 180, 240, 300];
        var roomCodes = Enumerable.Range(1000, 9000).OrderBy(_ => Random.Shared.Next()).Take(24).ToArray();
        IEnumerable<GameRehearsalRoomDto> rooms = Enumerable.Range(1,24).Select(index =>
        {
            var capacity = Random.Shared.Next(3, 7);
            var playerCount = Random.Shared.Next(1, capacity + 1);
            return new GameRehearsalRoomDto($"test-room-virtual-{index}", roomCodes[index - 1].ToString(),
                "WAITING", "PUBLIC", capacity, Random.Shared.Next(1, 6), playerCount, null, null,
                DateTime.UtcNow.AddMinutes(-Random.Shared.Next(1, 90)), answerTimes[Random.Shared.Next(answerTimes.Length)], votingTimes[Random.Shared.Next(votingTimes.Length)]);
        });
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status,"WAITING",StringComparison.OrdinalIgnoreCase)) rooms=[];
        if (!string.IsNullOrEmpty(roomCode)) rooms = rooms.Where(room => room.RoomCode.StartsWith(roomCode, StringComparison.OrdinalIgnoreCase));
        rooms=sort?.ToUpperInvariant() switch
        {
            "NEARLY_FULL" => rooms.OrderBy(room=>room.MaxPlayers-room.PlayerCount),
            "OPEN_SLOTS" => rooms.OrderByDescending(room=>room.MaxPlayers-room.PlayerCount),
            "NEWEST" => rooms.OrderByDescending(room=>room.CreatedAt),
            _ => rooms
        };
        var all=rooms.ToArray();
        return Ok(new ApiPage<GameRehearsalRoomDto>(all.Skip((page-1)*pageSize).Take(pageSize).ToArray(),page,pageSize,all.Length,(int)Math.Ceiling(all.Length/(double)pageSize)));
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("rehearsal-session")]
    public async Task<ActionResult<GameRehearsalSessionDto>> GetRehearsalSession(
        int count = 3, int players = 4, CancellationToken cancellationToken = default)
    {
        if (count is < 1 or > 6)
            return Problem(statusCode: 400, title: "回合數無效", detail: "演練素材一次可抽取一至六件文物。");
        if (!TryGetCurrentUserId(out var currentUserId)) return Unauthorized();
        if (players is <2 or >6) return Problem(statusCode: 400,title: "玩家人數無效",detail: "演練可使用二至六位玩家。");
        var currentPlayerName = await db.UserProfiles.AsNoTracking().Where(profile => profile.UserId == currentUserId)
            .Select(profile => profile.Nickname).SingleOrDefaultAsync(cancellationToken) ?? "玩家";
        var playerNames = await db.UserProfiles.AsNoTracking()
            .Where(profile => profile.UserId != currentUserId && profile.User.Status == "ACTIVE" && profile.Nickname != "")
            .OrderBy(_ => Guid.NewGuid()).Take(players-1).Select(profile => profile.Nickname).ToArrayAsync(cancellationToken);
        if (playerNames.Length < players-1)
            return Problem(statusCode: 409, title: "模擬玩家不足", detail: "有暱稱的啟用會員不足，請選擇人數較少的演練房間。");

        // 演練只讀取已完成回合，不建立房間、不改原回答或會員獎勵。
        var historical = db.RoundAnswers.AsNoTracking().Where(answer => answer.Round.IsSettled
            && answer.Round.Room.Status == "COMPLETED" && answer.Text != "");
        var artifacts = await db.Artifacts.AsNoTracking()
            .Where(artifact => artifact.IsActive && artifact.PrimaryImagePath != null && artifact.PrimaryImagePath != ""
                && historical.Any(answer => answer.Round.ArtifactId == artifact.Id && answer.AnswerType == "FACTUAL_REASONING")
                && historical.Any(answer => answer.Round.ArtifactId == artifact.Id && answer.AnswerType == "PLAUSIBLE_FICTION")
                && historical.Any(answer => answer.Round.ArtifactId == artifact.Id && answer.AnswerType == "CREATIVE_TALE"))
            .OrderBy(_ => Guid.NewGuid()).Take(count)
            .Select(artifact => new { artifact.Id, artifact.Name, artifact.PrimaryImagePath, artifact.ThumbnailPath })
            .ToListAsync(cancellationToken);
        if (artifacts.Count < count)
            return Problem(statusCode: 409, title: "演練素材不足", detail: "需要有圖片、且三類歷史回答完整的文物，才能開始演練。");

        var artifactIds = artifacts.Select(artifact => artifact.Id).ToArray();
        var answers = await historical.Where(answer => artifactIds.Contains(answer.Round.ArtifactId))
            .Select(answer => new { answer.Round.ArtifactId, answer.AnswerType, answer.Text })
            .ToListAsync(cancellationToken);
        string[] types = ["FACTUAL_REASONING", "PLAUSIBLE_FICTION", "CREATIVE_TALE"];
        if (artifacts.Any(artifact => types.Any(type => !answers.Any(answer => answer.ArtifactId == artifact.Id && answer.AnswerType == type))))
            return Problem(statusCode: 409, title: "演練素材已變更", detail: "歷史回答剛被更新或移除，請重新抽取素材。");
        var materials = artifacts.Select(artifact => new GameRehearsalMaterialDto(
            artifact.Id, artifact.Name, mediaUrlResolver.Resolve(artifact.PrimaryImagePath), mediaUrlResolver.Resolve(artifact.ThumbnailPath),
            types.Select(type => new GameRehearsalAnswerDto(type, answers
                .Where(answer => answer.ArtifactId == artifact.Id && answer.AnswerType == type)
                .OrderBy(_ => Random.Shared.Next()).First().Text)).ToArray())).ToArray();
        return Ok(new GameRehearsalSessionDto(materials, playerNames, currentPlayerName));
    }

    [AllowAnonymous]
    [HttpGet("rooms")]
    public async Task<ActionResult<ApiPage<GameRoomListItemDto>>> GetRooms(
        string? status,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default,
        string? roomCode = null)
    {
        var query = db.GameRooms
            .AsNoTracking()
            .Where(room => room.Visibility == "PUBLIC" && !room.IsShowcase);
        // 房號先篩選再分頁，不會漏掉其他頁的房間，也不開放搜尋私人房間。
        roomCode = roomCode?.Trim().ToUpperInvariant();
        if (roomCode?.Length > 16) return Problem(statusCode: 400, title: "房號過長");
        if (!string.IsNullOrEmpty(roomCode)) query = query.Where(room => room.RoomCode.StartsWith(roomCode));
        status = status?.Trim().ToUpperInvariant();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status is not ("WAITING" or "PLAYING" or "COMPLETED"))
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "房間狀態無效", detail: "status 只能是 WAITING、PLAYING 或 COMPLETED。");
            query = query.Where(room => room.Status == status);
        }
        else if (string.IsNullOrEmpty(roomCode))
        {
            // 用房號找人時不限狀態：滿座或已開始的公開房間也能找到並進場觀戰。
            query = query.Where(room => room.Status == "WAITING");
        }

        var sortCode = sort?.Trim().ToUpperInvariant() ?? "RECOMMENDED";
        if (sortCode is not ("RECOMMENDED" or "NEARLY_FULL" or "NEWEST" or "OPEN_SLOTS"))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "房間排序無效", detail: "sort 只能是 RECOMMENDED、NEARLY_FULL、NEWEST 或 OPEN_SLOTS。");

        var ordered = sortCode switch
        {
            "NEARLY_FULL" => query
                .OrderBy(room => room.MaxPlayers - room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"))
                .ThenByDescending(room => room.CreatedAt)
                .ThenBy(room => room.Id),
            "NEWEST" => query
                .OrderByDescending(room => room.CreatedAt)
                .ThenBy(room => room.Id),
            "OPEN_SLOTS" => query
                .OrderByDescending(room => room.MaxPlayers - room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"))
                .ThenByDescending(room => room.CreatedAt)
                .ThenBy(room => room.Id),
            _ => query
                .OrderByDescending(room => room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"))
                .ThenBy(room => room.MaxPlayers - room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"))
                .ThenByDescending(room => room.CreatedAt)
                .ThenBy(room => room.Id)
        };

        var projected = ordered
            .Select(room => new GameRoomListItemDto(
                room.Id,
                room.RoomCode,
                room.Status,
                room.Visibility,
                room.MaxPlayers,
                room.TotalRounds,
                room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"),
                room.CategoryFilterCode,
                room.EraBucketFilterCode,
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
            .Include(item => item.GameRounds)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (room is null || room.Status == "CANCELLED")
            return MissingResource("找不到遊戲房間", "這個房間不存在或已取消。");

        if (room.Visibility == "PRIVATE"
            && (!TryGetCurrentUserId(out var userId)
                || !room.GamePlayers.Any(player => player.UserId == userId)))
        {
            return MissingResource("找不到遊戲房間", "私人房間只對參與者開放。");
        }

        Guid? currentUserId = TryGetCurrentUserId(out var viewerId) ? viewerId : null;
        return Ok(ToRoomDto(room, currentUserId));
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

        if (room.Status == "PLAYING"
            && (!TryGetCurrentUserId(out var viewerId)
                || !room.GamePlayers.Any(player => player.UserId == viewerId && player.ConnectionStatus != "LEFT")))
        {
            return MissingResource("找不到遊戲房間", "遊戲進行中只對參與者開放回合紀錄。");
        }

        var rounds = room.GameRounds
            // 進行中的歷史只顯示已揭曉回合，不能由摘要或排行榜反推投票中回合的作者與票數。
            .Where(round => room.Status != "PLAYING" || (round.Status == "REVEALED" && round.IsSettled))
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
        return CreatedAtAction(nameof(GetRoom), new { id = room.Id }, ToRoomDto(room, userId));
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
        var result = await gameRoomLifecycleService.JoinAsync(
            id,
            userId,
            request.DisplayName,
            request.Password,
            cancellationToken);
        if (!result.Succeeded)
            return MutationFailure(result.Status);
        return Ok(ToRoomDto(result.Room!, userId));
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/ready")]
    public async Task<ActionResult<GameRoomDetailsDto>> SetReady(
        Guid id,
        SetGamePlayerReadyRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await gameRoomLifecycleService.SetReadyAsync(id, userId, request.IsReady, cancellationToken);
        if (!result.Succeeded)
            return MutationFailure(result.Status);
        return Ok(ToRoomDto(result.Room!, userId));
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/start")]
    public async Task<ActionResult<GameRoomDetailsDto>> StartRoom(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await gameRoomLifecycleService.StartAsync(id, userId, cancellationToken);
        if (!result.Succeeded)
            return MutationFailure(result.Status);
        return Ok(ToRoomDto(result.Room!, userId));
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/leave")]
    public async Task<ActionResult> LeaveRoom(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await gameRoomLifecycleService.LeaveAsync(id, userId, cancellationToken);
        if (!result.Succeeded)
            return MutationFailure(result.Status);
        return NoContent();
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/heartbeat")]
    public async Task<ActionResult> Heartbeat(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var result = await gameRoomLifecycleService.HeartbeatAsync(id, userId, cancellationToken);
        if (!result.Succeeded)
            return MutationFailure(result.Status);
        return NoContent();
    }

    [Authorize]
    [HttpPost("rooms/{id:guid}/close-solo")]
    public async Task<ActionResult> CloseSoloRoom(Guid id, CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        var result = await gameRoomLifecycleService.CloseSoloAsync(id, userId, cancellationToken);
        return result.Succeeded ? NoContent() : MutationFailure(result.Status);
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
        roomNotifier.Changed(round.RoomId);
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

        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult>(async retryToken =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, retryToken);

            var round = await db.GameRounds
                .SingleOrDefaultAsync(item => item.Id == id, retryToken);
            if (round is null)
                return MissingResource("找不到遊戲回合", "這個回合不存在。");
            var now = DateTime.UtcNow;
            if (round.Status != "VOTING" || round.VotingDeadlineAt <= now)
                return InvalidWorkflow("目前不是投票階段", "只有投票期限內的回合可以投票。");

            var voter = await db.GamePlayers
                .SingleOrDefaultAsync(item => item.RoomId == round.RoomId
                    && item.UserId == userId
                    && item.ConnectionStatus != "LEFT", retryToken);
            if (voter is null)
                return Forbid();
            var answer = await db.RoundAnswers
                .AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == request.AnswerId && item.RoundId == id, retryToken);
            if (answer is null)
                return MissingResource("找不到回答", "投票目標不屬於這個回合。");
            if (answer.GamePlayerId == voter.Id)
                return InvalidWorkflow("不能投給自己的回答", "請選擇其他玩家的回答。");

            if (await db.Votes.AnyAsync(vote => vote.RoundId == id
                    && vote.VoterGamePlayerId == voter.Id
                    && vote.Answer.RoundId == id
                    && vote.Answer.AnswerType == answer.AnswerType,
                retryToken))
            {
                return InvalidWorkflow("這種類型已投過票", "每回合每種類型只能投一票。");
            }

            db.Votes.Add(new Vote
            {
                Id = Guid.NewGuid(),
                RoundId = id,
                VoterGamePlayerId = voter.Id,
                AnswerId = answer.Id,
                Count = 1,
                SubmittedAt = now
            });
            await db.SaveChangesAsync(retryToken);
            await transaction.CommitAsync(retryToken);
            roomNotifier.Changed(round.RoomId);
            return Accepted();
        }, cancellationToken);
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
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        var player = round.Room.GamePlayers.SingleOrDefault(item =>
            item.UserId == userId && item.ConnectionStatus != "LEFT");
        if (player is null)
        {
            // 觀戰：公開房間任何登入者都能唯讀查看回合；識別為空，作答中不會看到任何回答。
            if (round.Room.Visibility != "PUBLIC")
                return Forbid();
            return Ok(ToRoundDetailsDto(round, Guid.Empty, [], mediaUrlResolver));
        }

        var votedAnswerIds = await db.Votes.AsNoTracking()
            .Where(vote => vote.RoundId == id && vote.VoterGamePlayerId == player.Id)
            .Select(vote => vote.AnswerId)
            .ToListAsync(cancellationToken);

        return Ok(ToRoundDetailsDto(round, player.Id, votedAnswerIds, mediaUrlResolver));
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

    private static GameRoomDetailsDto ToRoomDto(GameRoom room, Guid? currentUserId = null) => new(
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
        room.GameRounds
            .Where(round => round.RoundNumber == room.CurrentRoundNo)
            .Select(round => (Guid?)round.Id)
            .FirstOrDefault(),
        currentUserId.HasValue
            ? room.GamePlayers.FirstOrDefault(player =>
                player.UserId == currentUserId.Value && player.ConnectionStatus != "LEFT")?.Id
            : null,
        room.GamePlayers
            .Where(player => player.ConnectionStatus != "LEFT")
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

    private static GameRoundDetailsDto ToRoundDetailsDto(
        GameRound round,
        Guid currentPlayerId,
        IReadOnlyList<Guid> votedAnswerIds,
        QmahMediaUrlResolver mediaUrlResolver)
    {
        var answerRows = BuildRankedAnswers(round);
        if (round.Status == "ANSWERING")
            answerRows = answerRows.Where(row => row.Answer.GamePlayerId == currentPlayerId).ToList();
        // 揭曉前只保留本人識別所需資料，避免匿名投票的作者與票數從 API 提前洩漏。
        var revealed = round.Status == "REVEALED" && round.IsSettled;
        if (!revealed)
            answerRows = answerRows.OrderBy(row => row.Answer.SubmittedAt).ToList();
        var winner = revealed ? GetWinner(answerRows, true) : null;
        return new GameRoundDetailsDto(
            round.Id,
            round.RoomId,
            currentPlayerId,
            votedAnswerIds,
            round.ArtifactId,
            round.Artifact.Name,
            mediaUrlResolver.Resolve(round.Artifact.PrimaryImagePath),
            mediaUrlResolver.Resolve(round.Artifact.ThumbnailPath),
            round.RoundNumber,
            round.Status,
            round.IsSettled,
            round.StartedAt,
            round.AnswerDeadlineAt,
            round.VotingDeadlineAt,
            round.SettledAt,
            round.Room.GamePlayers.Count(player => player.ConnectionStatus != "LEFT"),
            round.RoundAnswers.Count,
            revealed ? answerRows.Sum(row => row.VoteCount) : 0,
            winner?.Answer.Id,
            winner?.Answer.GamePlayer.DisplayName,
            answerRows.Select((row, index) => new GameAnswerDto(
                row.Answer.Id,
                revealed || row.Answer.GamePlayerId == currentPlayerId ? row.Answer.GamePlayerId : Guid.Empty,
                revealed ? row.Answer.GamePlayer.DisplayName : string.Empty,
                row.Answer.AnswerType,
                row.Answer.Text,
                revealed ? row.VoteCount : 0,
                revealed ? index + 1 : 0,
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
                    .Where(round => round.IsSettled)
                    .SelectMany(round => round.RoundAnswers)
                    .Where(answer => answer.GamePlayerId == player.Id)
                    .ToList();
                var roundsWon = room.GameRounds
                    .Where(round => round.IsSettled)
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

    private ActionResult MutationFailure(GameRoomMutationStatus status) => status switch
    {
        GameRoomMutationStatus.NotFound => NotFound(),
        GameRoomMutationStatus.Forbidden => Forbid(),
        _ => Conflict()
    };
}
