using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("投票", order: 60)]
public sealed class VotesController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        Guid? roundId,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        sort = NormalizeSort(sort);
        var query = db.Votes.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Round.Room.RoomCode.Contains(search) ||
                x.VoterGamePlayer.DisplayName.Contains(search) ||
                x.Answer.GamePlayer.DisplayName.Contains(search));
        }

        if (roundId.HasValue)
        {
            query = query.Where(x => x.RoundId == roundId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = sort switch
        {
            "room" => query.OrderBy(x => x.Round.Room.RoomCode).ThenByDescending(x => x.SubmittedAt),
            "count" => query.OrderByDescending(x => x.Count).ThenByDescending(x => x.SubmittedAt),
            "voter" => query.OrderBy(x => x.VoterGamePlayer.DisplayName).ThenByDescending(x => x.SubmittedAt),
            _ => query.OrderByDescending(x => x.SubmittedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new VoteListItemViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                VoterName = x.VoterGamePlayer.DisplayName,
                AnswerPlayerName = x.Answer.GamePlayer.DisplayName,
                Count = x.Count,
                SubmittedAt = x.SubmittedAt
            })
            .ToListAsync(cancellationToken);

        await LoadRoundOptionsAsync(roundId, cancellationToken);

        return View(new VoteIndexViewModel
        {
            Search = search,
            RoundId = roundId,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<VoteListItemViewModel>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            }
        });
    }

    public async Task<IActionResult> Details(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.Votes
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new VoteDetailsViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                VoterName = x.VoterGamePlayer.DisplayName,
                AnswerPlayerName = x.Answer.GamePlayer.DisplayName,
                Count = x.Count,
                SubmittedAt = x.SubmittedAt,
                AnswerText = x.Answer.Text,
                AnswerType = x.Answer.AnswerType
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(Guid? roundId, CancellationToken cancellationToken)
    {
        await LoadFormOptionsAsync(roundId, null, null, cancellationToken);
        return View(new VoteCreateViewModel
        {
            RoundId = roundId,
            SubmittedAt = DateTime.Now
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        VoteCreateViewModel model,
        CancellationToken cancellationToken)
    {
        await ValidateReferencesAsync(model, cancellationToken);

        if (model.RoundId.HasValue && model.VoterGamePlayerId.HasValue && model.AnswerId.HasValue && await db.Votes.AnyAsync(
                x => x.RoundId == model.RoundId.Value &&
                     x.VoterGamePlayerId == model.VoterGamePlayerId.Value &&
                     x.AnswerId == model.AnswerId.Value,
                cancellationToken))
        {
            ModelState.AddModelError(string.Empty, "同一玩家在同一回合對同一筆作答只能有一筆投票");
        }

        if (!ModelState.IsValid)
        {
            await LoadFormOptionsAsync(model.RoundId, model.VoterGamePlayerId, model.AnswerId, cancellationToken);
            return View(model);
        }

        var entity = new Vote
        {
            Id = Guid.NewGuid(),
            RoundId = model.RoundId!.Value,
            VoterGamePlayerId = model.VoterGamePlayerId!.Value,
            AnswerId = model.AnswerId!.Value,
            Count = model.Count,
            SubmittedAt = ToUtc(model.SubmittedAt)
        };
        db.Votes.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "投票資料已建立。";
            return RedirectToAction(nameof(Details), new { id = entity.Id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認回合、玩家與作答關聯。");
            await LoadFormOptionsAsync(model.RoundId, model.VoterGamePlayerId, model.AnswerId, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.Votes
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new VoteEditViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                VoterGamePlayerId = x.VoterGamePlayerId,
                AnswerId = x.AnswerId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                VoterName = x.VoterGamePlayer.DisplayName,
                AnswerPlayerName = x.Answer.GamePlayer.DisplayName,
                Count = x.Count,
                SubmittedAt = x.SubmittedAt,
                RowVersion = Convert.ToBase64String(x.RowVersion)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (model is null)
        {
            return NotFound();
        }

        model.SubmittedAt = model.SubmittedAt.ToLocalTime();
        await LoadFormOptionsAsync(model.RoundId, model.VoterGamePlayerId, model.AnswerId, cancellationToken);
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        VoteEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        await ValidateReferencesAsync(model, cancellationToken);

        var entity = await db.Votes.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        await PopulateEditSummaryAsync(model, entity, cancellationToken);

        if (model.RoundId.HasValue && model.VoterGamePlayerId.HasValue && model.AnswerId.HasValue && await db.Votes.AnyAsync(
                x => x.Id != id &&
                     x.RoundId == model.RoundId.Value &&
                     x.VoterGamePlayerId == model.VoterGamePlayerId.Value &&
                     x.AnswerId == model.AnswerId.Value,
                cancellationToken))
        {
            ModelState.AddModelError(string.Empty, "同一玩家在同一回合對同一筆作答只能有一筆投票");
        }

        if (!TrySetOriginalRowVersion(entity, model.RowVersion))
        {
            ModelState.AddModelError(string.Empty, "版本資訊已失效，請重新載入頁面。");
        }

        if (!ModelState.IsValid)
        {
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            await LoadFormOptionsAsync(model.RoundId, model.VoterGamePlayerId, model.AnswerId, cancellationToken);
            return View(model);
        }

        entity.RoundId = model.RoundId!.Value;
        entity.VoterGamePlayerId = model.VoterGamePlayerId!.Value;
        entity.AnswerId = model.AnswerId!.Value;
        entity.Count = model.Count;
        entity.SubmittedAt = ToUtc(model.SubmittedAt);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "投票資料已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "投票資料已被其他操作更新，請重新確認。");
            await db.Entry(entity).ReloadAsync(cancellationToken);
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認投票關聯與票數。");
        }

        await LoadFormOptionsAsync(model.RoundId, model.VoterGamePlayerId, model.AnswerId, cancellationToken);
        return View(model);
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.Votes
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new VoteDeleteViewModel
            {
                Id = x.Id,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                VoterName = x.VoterGamePlayer.DisplayName,
                AnswerPlayerName = x.Answer.GamePlayer.DisplayName,
                Count = x.Count,
                RowVersion = Convert.ToBase64String(x.RowVersion)
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    [HttpPost, ActionName("Delete")]
    public async Task<IActionResult> DeleteConfirmed(
        Guid id,
        string rowVersion,
        CancellationToken cancellationToken)
    {
        var entity = await db.Votes.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        if (!TrySetOriginalRowVersion(entity, rowVersion))
        {
            TempData["Error"] = "版本資訊已失效，請重新載入頁面。";
            return RedirectToAction(nameof(Delete), new { id });
        }

        db.Votes.Remove(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "投票資料已刪除。";
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["Error"] = "投票資料已被其他操作更新，請重新確認。";
        }
        catch (DbUpdateException)
        {
            TempData["Error"] = "投票資料目前無法刪除，請確認相關紀錄。";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateReferencesAsync(
        VoteFormViewModel model,
        CancellationToken cancellationToken)
    {
        var round = model.RoundId.HasValue
            ? await db.GameRounds.AsNoTracking().SingleOrDefaultAsync(x => x.Id == model.RoundId.Value, cancellationToken)
            : null;
        if (round is null)
        {
            ModelState.AddModelError(nameof(model.RoundId), "回合不存在");
        }

        var voter = model.VoterGamePlayerId.HasValue
            ? await db.GamePlayers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == model.VoterGamePlayerId.Value, cancellationToken)
            : null;
        if (voter is null)
        {
            ModelState.AddModelError(nameof(model.VoterGamePlayerId), "投票玩家不存在");
        }
        else if (round is not null && voter.RoomId != round.RoomId)
        {
            ModelState.AddModelError(nameof(model.VoterGamePlayerId), "投票玩家必須屬於該回合的房間");
        }

        var answer = model.AnswerId.HasValue
            ? await db.RoundAnswers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == model.AnswerId.Value, cancellationToken)
            : null;
        if (answer is null)
        {
            ModelState.AddModelError(nameof(model.AnswerId), "被投作答不存在");
        }
        else if (round is not null && answer.RoundId != round.Id)
        {
            ModelState.AddModelError(nameof(model.AnswerId), "被投作答必須屬於該回合");
        }
    }

    private async Task PopulateEditSummaryAsync(
        VoteEditViewModel model,
        Vote entity,
        CancellationToken cancellationToken)
    {
        var summary = await db.Votes
            .AsNoTracking()
            .Where(x => x.Id == entity.Id)
            .Select(x => new
            {
                RoomCode = x.Round.Room.RoomCode,
                x.Round.RoundNumber,
                VoterName = x.VoterGamePlayer.DisplayName,
                AnswerPlayerName = x.Answer.GamePlayer.DisplayName
            })
            .SingleAsync(cancellationToken);
        model.RoomCode = summary.RoomCode;
        model.RoundNumber = summary.RoundNumber;
        model.VoterName = summary.VoterName;
        model.AnswerPlayerName = summary.AnswerPlayerName;
    }

    private async Task LoadRoundOptionsAsync(Guid? selected, CancellationToken cancellationToken)
    {
        var rounds = await db.GameRounds
            .AsNoTracking()
            .OrderByDescending(x => x.StartedAt)
            .Select(x => new { x.Id, Label = x.Room.RoomCode + " · 第 " + x.RoundNumber + " 回合" })
            .ToListAsync(cancellationToken);
        ViewBag.Rounds = new SelectList(rounds, "Id", "Label", selected);
    }

    private async Task LoadFormOptionsAsync(
        Guid? roundId,
        Guid? voterId,
        Guid? answerId,
        CancellationToken cancellationToken)
    {
        await LoadRoundOptionsAsync(roundId, cancellationToken);

        var players = await db.GamePlayers
            .AsNoTracking()
            .OrderBy(x => x.DisplayName)
            .Select(x => new { x.Id, Label = x.DisplayName + " · " + x.Room.RoomCode })
            .ToListAsync(cancellationToken);
        ViewBag.Players = new SelectList(players, "Id", "Label", voterId);

        var answers = await db.RoundAnswers
            .AsNoTracking()
            .OrderByDescending(x => x.SubmittedAt)
            .Select(x => new
            {
                x.Id,
                Label = x.Round.Room.RoomCode + " · 第 " + x.Round.RoundNumber + " 回合 · " + x.GamePlayer.DisplayName
            })
            .ToListAsync(cancellationToken);
        ViewBag.Answers = new SelectList(answers, "Id", "Label", answerId);
    }

    private bool TrySetOriginalRowVersion(Vote entity, string rowVersion)
    {
        try
        {
            db.Entry(entity).Property(x => x.RowVersion).OriginalValue = Convert.FromBase64String(rowVersion);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static DateTime ToUtc(DateTime value) => value.Kind == DateTimeKind.Utc
        ? value
        : TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified));

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "room" or "count" or "voter" => sort.Trim().ToLowerInvariant(),
        _ => "submitted"
    };
}
