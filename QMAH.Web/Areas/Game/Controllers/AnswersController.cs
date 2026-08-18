using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("作答", order: 50)]
public sealed class AnswersController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        Guid? roundId,
        string? answerType,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        answerType = NormalizeFilter(answerType, GameCodeLists.AnswerTypes);
        sort = NormalizeSort(sort);

        var query = db.RoundAnswers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Text.Contains(search) ||
                x.GamePlayer.DisplayName.Contains(search) ||
                x.Round.Room.RoomCode.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(answerType))
        {
            query = query.Where(x => x.AnswerType == answerType);
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
            "player" => query.OrderBy(x => x.GamePlayer.DisplayName).ThenByDescending(x => x.SubmittedAt),
            "votes" => query.OrderByDescending(x => x.Votes.Sum(v => v.Count)).ThenByDescending(x => x.SubmittedAt),
            _ => query.OrderByDescending(x => x.SubmittedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AnswerListItemViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                PlayerName = x.GamePlayer.DisplayName,
                AnswerType = x.AnswerType,
                Text = x.Text,
                SubmittedAt = x.SubmittedAt,
                VoteCount = x.Votes.Sum(v => v.Count)
            })
            .ToListAsync(cancellationToken);

        await LoadRoundOptionsAsync(roundId, cancellationToken);

        return View(new AnswerIndexViewModel
        {
            Search = search,
            RoundId = roundId,
            AnswerType = answerType,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<AnswerListItemViewModel>
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
        var model = await db.RoundAnswers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AnswerDetailsViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                ArtifactName = x.Round.Artifact.Name,
                PlayerName = x.GamePlayer.DisplayName,
                AnswerType = x.AnswerType,
                Text = x.Text,
                SubmittedAt = x.SubmittedAt,
                VoteCount = x.Votes.Sum(v => v.Count),
                Votes = x.Votes
                    .OrderByDescending(v => v.SubmittedAt)
                    .Select(v => new VoteListItemViewModel
                    {
                        Id = v.Id,
                        RoundId = v.RoundId,
                        RoomCode = v.Round.Room.RoomCode,
                        RoundNumber = v.Round.RoundNumber,
                        VoterName = v.VoterGamePlayer.DisplayName,
                        AnswerPlayerName = x.GamePlayer.DisplayName,
                        Count = v.Count,
                        SubmittedAt = v.SubmittedAt
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(Guid? roundId, CancellationToken cancellationToken)
    {
        await LoadFormOptionsAsync(roundId, null, cancellationToken);
        return View(new AnswerCreateViewModel
        {
            RoundId = roundId,
            SubmittedAt = DateTime.Now
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        AnswerCreateViewModel model,
        CancellationToken cancellationToken)
    {
        Normalize(model);
        await ValidateReferencesAsync(model, cancellationToken);

        if (model.RoundId.HasValue && model.GamePlayerId.HasValue && await db.RoundAnswers.AnyAsync(
                x => x.RoundId == model.RoundId.Value && x.GamePlayerId == model.GamePlayerId.Value,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.GamePlayerId), "同一個玩家在同一回合只能有一筆作答");
        }

        if (!ModelState.IsValid)
        {
            await LoadFormOptionsAsync(model.RoundId, model.GamePlayerId, cancellationToken);
            return View(model);
        }

        var entity = new RoundAnswer
        {
            Id = Guid.NewGuid(),
            RoundId = model.RoundId!.Value,
            GamePlayerId = model.GamePlayerId!.Value,
            AnswerType = model.AnswerType,
            Text = model.Text,
            SubmittedAt = ToUtc(model.SubmittedAt)
        };
        db.RoundAnswers.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "作答資料已建立。";
            return RedirectToAction(nameof(Details), new { id = entity.Id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認回合、玩家與作答內容。");
            await LoadFormOptionsAsync(model.RoundId, model.GamePlayerId, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.RoundAnswers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AnswerEditViewModel
            {
                Id = x.Id,
                RoundId = x.RoundId,
                GamePlayerId = x.GamePlayerId,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                PlayerName = x.GamePlayer.DisplayName,
                AnswerType = x.AnswerType,
                Text = x.Text,
                SubmittedAt = x.SubmittedAt,
                VoteCount = x.Votes.Count,
                RowVersion = Convert.ToBase64String(x.RowVersion)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (model is null)
        {
            return NotFound();
        }

        model.SubmittedAt = model.SubmittedAt.ToLocalTime();
        await LoadFormOptionsAsync(model.RoundId, model.GamePlayerId, cancellationToken);
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        AnswerEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        Normalize(model);
        await ValidateReferencesAsync(model, cancellationToken);

        var entity = await db.RoundAnswers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        await PopulateEditSummaryAsync(model, entity, cancellationToken);

        if (model.RoundId.HasValue && model.GamePlayerId.HasValue && await db.RoundAnswers.AnyAsync(
                x => x.Id != id && x.RoundId == model.RoundId.Value && x.GamePlayerId == model.GamePlayerId.Value,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.GamePlayerId), "同一個玩家在同一回合只能有一筆作答");
        }

        if (!TrySetOriginalRowVersion(entity, model.RowVersion))
        {
            ModelState.AddModelError(string.Empty, "版本資訊已失效，請重新載入頁面。");
        }

        if (!ModelState.IsValid)
        {
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            await LoadFormOptionsAsync(model.RoundId, model.GamePlayerId, cancellationToken);
            return View(model);
        }

        entity.RoundId = model.RoundId!.Value;
        entity.GamePlayerId = model.GamePlayerId!.Value;
        entity.AnswerType = model.AnswerType;
        entity.Text = model.Text;
        entity.SubmittedAt = ToUtc(model.SubmittedAt);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "作答資料已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "作答資料已被其他操作更新，請重新確認。");
            await db.Entry(entity).ReloadAsync(cancellationToken);
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認作答關聯與內容。");
        }

        await LoadFormOptionsAsync(model.RoundId, model.GamePlayerId, cancellationToken);
        return View(model);
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.RoundAnswers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AnswerDeleteViewModel
            {
                Id = x.Id,
                RoomCode = x.Round.Room.RoomCode,
                RoundNumber = x.Round.RoundNumber,
                PlayerName = x.GamePlayer.DisplayName,
                Text = x.Text,
                VoteCount = x.Votes.Count,
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
        var entity = await db.RoundAnswers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        if (await db.Votes.AnyAsync(x => x.AnswerId == id, cancellationToken))
        {
            TempData["Error"] = "已有投票指向這筆作答，不能刪除，請保留歷史資料。";
            return RedirectToAction(nameof(Details), new { id });
        }

        if (!TrySetOriginalRowVersion(entity, rowVersion))
        {
            TempData["Error"] = "版本資訊已失效，請重新載入頁面。";
            return RedirectToAction(nameof(Delete), new { id });
        }

        db.RoundAnswers.Remove(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "作答資料已刪除。";
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["Error"] = "作答資料已被其他操作更新，請重新確認。";
        }
        catch (DbUpdateException)
        {
            TempData["Error"] = "作答目前無法刪除，請確認投票關聯。";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateReferencesAsync(
        AnswerFormViewModel model,
        CancellationToken cancellationToken)
    {
        model.AnswerType = (model.AnswerType ?? string.Empty).Trim().ToUpperInvariant();
        model.Text = (model.Text ?? string.Empty).Trim();

        if (!GameCodeLists.AnswerTypes.ContainsKey(model.AnswerType))
        {
            ModelState.AddModelError(nameof(model.AnswerType), "作答類型不正確");
        }

        var round = model.RoundId.HasValue
            ? await db.GameRounds.AsNoTracking().SingleOrDefaultAsync(x => x.Id == model.RoundId.Value, cancellationToken)
            : null;
        if (round is null)
        {
            ModelState.AddModelError(nameof(model.RoundId), "回合不存在");
        }

        var player = model.GamePlayerId.HasValue
            ? await db.GamePlayers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == model.GamePlayerId.Value, cancellationToken)
            : null;
        if (player is null)
        {
            ModelState.AddModelError(nameof(model.GamePlayerId), "玩家不存在");
        }
        else if (round is not null && player.RoomId != round.RoomId)
        {
            ModelState.AddModelError(nameof(model.GamePlayerId), "作答玩家必須屬於該回合的房間");
        }
    }

    private async Task PopulateEditSummaryAsync(
        AnswerEditViewModel model,
        RoundAnswer entity,
        CancellationToken cancellationToken)
    {
        var summary = await db.RoundAnswers
            .AsNoTracking()
            .Where(x => x.Id == entity.Id)
            .Select(x => new
            {
                RoomCode = x.Round.Room.RoomCode,
                x.Round.RoundNumber,
                PlayerName = x.GamePlayer.DisplayName,
                VoteCount = x.Votes.Count
            })
            .SingleAsync(cancellationToken);
        model.RoomCode = summary.RoomCode;
        model.RoundNumber = summary.RoundNumber;
        model.PlayerName = summary.PlayerName;
        model.VoteCount = summary.VoteCount;
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
        Guid? playerId,
        CancellationToken cancellationToken)
    {
        await LoadRoundOptionsAsync(roundId, cancellationToken);

        var players = await db.GamePlayers
            .AsNoTracking()
            .OrderBy(x => x.DisplayName)
            .Select(x => new
            {
                x.Id,
                Label = x.DisplayName + " · " + x.Room.RoomCode
            })
            .ToListAsync(cancellationToken);
        ViewBag.Players = new SelectList(players, "Id", "Label", playerId);
    }

    private bool TrySetOriginalRowVersion(RoundAnswer entity, string rowVersion)
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

    private static void Normalize(AnswerFormViewModel model)
    {
        model.AnswerType = (model.AnswerType ?? string.Empty).Trim().ToUpperInvariant();
        model.Text = (model.Text ?? string.Empty).Trim();
    }

    private static DateTime ToUtc(DateTime value) => value.Kind == DateTimeKind.Utc
        ? value
        : TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified));

    private static string? NormalizeFilter(string? value, IReadOnlyDictionary<string, string> allowed)
    {
        value = value?.Trim().ToUpperInvariant();
        return !string.IsNullOrWhiteSpace(value) && allowed.ContainsKey(value) ? value : null;
    }

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "room" or "player" or "votes" => sort.Trim().ToLowerInvariant(),
        _ => "submitted"
    };
}
