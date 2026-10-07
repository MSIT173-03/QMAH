using System.Text.Json.Serialization;
using QMAH.Api.Infrastructure.Json;
using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/game/appreciation")]
public sealed class GameAppreciationController(QmahDbContext db) : ApiControllerBase
{
    // 每間已完成房間各類回答的第一名。先選出勝者再篩文物，避免篩選改變原排名。
    private IQueryable<Guid> WinnerIds()
        => db.RoundAnswers.FromSqlRaw("""
            SELECT answer.* FROM [game].[RoundAnswers] answer
            INNER JOIN (
                SELECT a.Id, ROW_NUMBER() OVER (
                    PARTITION BY round.RoomId, a.AnswerType
                    ORDER BY COALESCE(totals.Votes,0) DESC, a.SubmittedAt, a.Id) AS Position
                FROM [game].[RoundAnswers] a
                INNER JOIN [game].[GameRounds] round ON round.Id=a.RoundId
                INNER JOIN [game].[GameRooms] room ON room.Id=round.RoomId
                INNER JOIN [catalog].[Artifacts] artifact ON artifact.Id=round.ArtifactId
                LEFT JOIN (SELECT AnswerId, SUM([Count]) AS Votes FROM [game].[Votes] GROUP BY AnswerId) totals ON totals.AnswerId=a.Id
                WHERE room.Status=N'COMPLETED' AND room.CompletedAt IS NOT NULL
                    AND round.IsSettled=1 AND artifact.IsActive=1
            ) ranked ON ranked.Id=answer.Id AND ranked.Position=1
            """).Select(answer => answer.Id);

    [HttpGet]
    public async Task<ActionResult<ApiPage<AppreciationAnswerDto>>> List(
        [FromQuery] Guid? artifactId, [FromQuery] string? categoryCode, [FromQuery] string? answerType,
        [FromQuery] string sort = "votes", [FromQuery] int page = 1, [FromQuery] int pageSize = 12,
        [FromQuery] string? keyword = null, [FromQuery] string? eraCode = null,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        if (sort is not ("votes" or "time") || answerType is not (null or "" or "FACTUAL_REASONING" or "PLAUSIBLE_FICTION" or "CREATIVE_TALE"))
            return BadRequest();
        var winners = WinnerIds();
        var query = db.RoundAnswers.AsNoTracking().Where(answer => winners.Contains(answer.Id));
        keyword = keyword?.Trim();
        if (keyword?.Length > 100) return BadRequest("搜尋文字最多可輸入 100 字。");
        if (artifactId.HasValue) query = query.Where(answer => answer.Round.ArtifactId == artifactId);
        if (!string.IsNullOrWhiteSpace(categoryCode)) query = query.Where(answer => answer.Round.Artifact.Category.Code == categoryCode);
        if (!string.IsNullOrWhiteSpace(eraCode)) query = query.Where(answer => answer.Round.Artifact.EraBucket.Code == eraCode);
        // 與圖鑑使用相同搜尋欄位，先由資料庫篩選，再排序與分頁。
        if (!string.IsNullOrWhiteSpace(keyword)) query = query.Where(answer =>
            answer.Round.Artifact.Name.Contains(keyword) || answer.Round.Artifact.ArtifactRef.Contains(keyword)
            || answer.Round.Artifact.EraBucket.Name.Contains(keyword) || answer.Round.Artifact.Category.Name.Contains(keyword));
        if (!string.IsNullOrWhiteSpace(answerType)) query = query.Where(answer => answer.AnswerType == answerType);
        var ranked = query.Select(answer => new {
            Answer = answer,
            VoteCount = db.ArtifactAppreciationVotes.Count(vote => vote.AnswerId == answer.Id)
        });
        var ordered = sort == "time" ? ranked.OrderByDescending(item => item.Answer.Round.Room.CompletedAt).ThenBy(item => item.Answer.Id)
            : ranked.OrderByDescending(item => item.VoteCount).ThenByDescending(item => item.Answer.Round.Room.CompletedAt).ThenBy(item => item.Answer.Id);
        var projected = ordered.Select(item => new AppreciationAnswerDto(item.Answer.Id, item.Answer.Round.RoomId,
            item.Answer.Round.Room.RoomCode, item.Answer.Round.ArtifactId, item.Answer.Round.Artifact.Name,
            item.Answer.Round.Artifact.Category.Name, item.Answer.AnswerType, item.Answer.Text, item.Answer.GamePlayer.DisplayName,
            item.Answer.Round.Room.CompletedAt!.Value, item.Answer.Votes.Sum(vote => vote.Count),
            item.VoteCount,
            db.ArtifactAppreciationVotes.Any(vote => vote.AnswerId == item.Answer.Id && vote.UserId == userId),
            item.Answer.GamePlayer.UserId == userId,
            item.Answer.Round.Artifact.ThumbnailPath ?? item.Answer.Round.Artifact.PrimaryImagePath));
        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    [HttpPut("{answerId:guid}/vote")]
    public async Task<ActionResult<AppreciationVoteDto>> Vote(Guid answerId, AppreciationVoteRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<ActionResult<AppreciationVoteDto>>(async token => {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token);
            var eligible = await db.RoundAnswers.Where(answer => WinnerIds().Contains(answer.Id) && answer.Id == answerId)
                .Select(answer => new { answer.GamePlayer.UserId }).SingleOrDefaultAsync(token);
            if (eligible is null) return MissingResource("找不到鑑賞回答", "這則回答尚未入選，或已不在鑑賞區。");
            if (eligible.UserId == userId) return InvalidWorkflow("不能投自己的回答", "請把票投給其他玩家的回答。");
            var existing = await db.ArtifactAppreciationVotes.SingleOrDefaultAsync(vote => vote.AnswerId == answerId && vote.UserId == userId, token);
            if (request.Voted && existing is null)
                db.ArtifactAppreciationVotes.Add(new ArtifactAppreciationVote { AnswerId = answerId, UserId = userId, CreatedAt = DateTime.UtcNow });
            else if (!request.Voted && existing is not null) db.ArtifactAppreciationVotes.Remove(existing);
            await db.SaveChangesAsync(token);
            var count = await db.ArtifactAppreciationVotes.CountAsync(vote => vote.AnswerId == answerId, token);
            await transaction.CommitAsync(token);
            return Ok(new AppreciationVoteDto(request.Voted, count));
        }, cancellationToken);
    }
}

public sealed record AppreciationAnswerDto(Guid Id, Guid RoomId, string RoomCode, Guid ArtifactId,
    string ArtifactName, string CategoryName, string AnswerType, string Text, string Author,
    [property: JsonConverter(typeof(UtcDateTimeJsonConverter))] DateTime CompletedAt, int GameVotes, int VoteCount, bool Voted, bool IsOwn, string? ImagePath);
public sealed record AppreciationVoteRequest(bool Voted);
public sealed record AppreciationVoteDto(bool Voted, int VoteCount);
