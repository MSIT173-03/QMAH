using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("回合", order: 40)]
public sealed class RoundsController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        string? status,
        Guid? roomId,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        status = NormalizeFilter(status, GameCodeLists.RoundStatuses);
        sort = NormalizeSort(sort);

        var query = db.GameRounds.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Room.RoomCode.Contains(search) ||
                x.Artifact.Name.Contains(search) ||
                x.Artifact.ArtifactRef.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        if (roomId.HasValue)
        {
            query = query.Where(x => x.RoomId == roomId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = sort switch
        {
            "room" => query.OrderBy(x => x.Room.RoomCode).ThenBy(x => x.RoundNumber),
            "round" => query.OrderByDescending(x => x.RoundNumber).ThenByDescending(x => x.StartedAt),
            "status" => query.OrderBy(x => x.Status).ThenByDescending(x => x.StartedAt),
            "answers" => query.OrderByDescending(x => x.RoundAnswers.Count).ThenByDescending(x => x.StartedAt),
            _ => query.OrderByDescending(x => x.StartedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new RoundListItemViewModel
            {
                Id = x.Id,
                RoomId = x.RoomId,
                ArtifactId = x.ArtifactId,
                RoomCode = x.Room.RoomCode,
                RoundNumber = x.RoundNumber,
                ArtifactName = x.Artifact.Name,
                Status = x.Status,
                IsSettled = x.IsSettled,
                StartedAt = x.StartedAt,
                AnswerDeadlineAt = x.AnswerDeadlineAt,
                VotingDeadlineAt = x.VotingDeadlineAt,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count
            })
            .ToListAsync(cancellationToken);

        await LoadRoomOptionsAsync(roomId, cancellationToken);

        return View(new RoundIndexViewModel
        {
            Search = search,
            Status = status,
            RoomId = roomId,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<RoundListItemViewModel>
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
        var model = await db.GameRounds
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoundDetailsViewModel
            {
                Id = x.Id,
                RoomId = x.RoomId,
                ArtifactId = x.ArtifactId,
                RowVersion = Convert.ToBase64String(x.RowVersion),
                RoomCode = x.Room.RoomCode,
                RoundNumber = x.RoundNumber,
                ArtifactName = x.Artifact.Name,
                ArtifactRef = x.Artifact.ArtifactRef,
                ImagePath = x.Artifact.ThumbnailPath ?? x.Artifact.PrimaryImagePath,
                Status = x.Status,
                StateVersion = x.StateVersion,
                IsSettled = x.IsSettled,
                StartedAt = x.StartedAt,
                AnswerDeadlineAt = x.AnswerDeadlineAt,
                VotingDeadlineAt = x.VotingDeadlineAt,
                SettledAt = x.SettledAt,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count,
                Answers = x.RoundAnswers
                    .OrderBy(a => a.SubmittedAt)
                    .Select(a => new AnswerListItemViewModel
                    {
                        Id = a.Id,
                        RoundId = x.Id,
                        RoomCode = x.Room.RoomCode,
                        RoundNumber = x.RoundNumber,
                        PlayerName = a.GamePlayer.DisplayName,
                        AnswerType = a.AnswerType,
                        Text = a.Text,
                        SubmittedAt = a.SubmittedAt,
                        VoteCount = a.Votes.Sum(v => v.Count)
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(Guid? roomId, CancellationToken cancellationToken)
    {
        var now = DateTime.Now;
        await LoadFormOptionsAsync(roomId, null, cancellationToken);
        return View(new RoundCreateViewModel
        {
            RoomId = roomId,
            StartedAt = now,
            AnswerDeadlineAt = now.AddMinutes(2),
            VotingDeadlineAt = now.AddMinutes(3)
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        RoundCreateViewModel model,
        CancellationToken cancellationToken)
    {
        Normalize(model);
        await ValidateReferencesAsync(model, null, cancellationToken);

        if (model.RoomId.HasValue && await db.GameRounds.AnyAsync(
                x => x.RoomId == model.RoomId.Value && x.RoundNumber == model.RoundNumber,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.RoundNumber), "同一個房間不能有重複的回合編號");
        }

        if (!ModelState.IsValid)
        {
            await LoadFormOptionsAsync(model.RoomId, model.ArtifactId, cancellationToken);
            return View(model);
        }

        var entity = new GameRound
        {
            Id = Guid.NewGuid(),
            RoomId = model.RoomId!.Value,
            ArtifactId = model.ArtifactId!.Value,
            RoundNumber = model.RoundNumber,
            Status = model.Status,
            StateVersion = model.StateVersion,
            IsSettled = model.IsSettled,
            StartedAt = ToUtc(model.StartedAt),
            AnswerDeadlineAt = ToUtc(model.AnswerDeadlineAt),
            VotingDeadlineAt = ToUtc(model.VotingDeadlineAt),
            SettledAt = model.IsSettled ? ToUtc(model.SettledAt!.Value) : null
        };
        db.GameRounds.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "回合資料已建立。";
            return RedirectToAction(nameof(Details), new { id = entity.Id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認房間、文物與回合編號。");
            await LoadFormOptionsAsync(model.RoomId, model.ArtifactId, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.GameRounds
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoundEditViewModel
            {
                Id = x.Id,
                RoomId = x.RoomId,
                ArtifactId = x.ArtifactId,
                RoomCode = x.Room.RoomCode,
                ArtifactName = x.Artifact.Name,
                RoundNumber = x.RoundNumber,
                Status = x.Status,
                StateVersion = x.StateVersion,
                IsSettled = x.IsSettled,
                StartedAt = x.StartedAt,
                AnswerDeadlineAt = x.AnswerDeadlineAt,
                VotingDeadlineAt = x.VotingDeadlineAt,
                SettledAt = x.SettledAt,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count,
                RowVersion = Convert.ToBase64String(x.RowVersion)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (model is null)
        {
            return NotFound();
        }

        model.StartedAt = model.StartedAt.ToLocalTime();
        model.AnswerDeadlineAt = model.AnswerDeadlineAt.ToLocalTime();
        model.VotingDeadlineAt = model.VotingDeadlineAt.ToLocalTime();
        model.SettledAt = model.SettledAt?.ToLocalTime();
        await LoadFormOptionsAsync(model.RoomId, model.ArtifactId, cancellationToken);
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        RoundEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        Normalize(model);
        await ValidateReferencesAsync(model, id, cancellationToken);

        var entity = await db.GameRounds.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        model.RoomCode = await db.GameRooms
            .Where(x => x.Id == entity.RoomId)
            .Select(x => x.RoomCode)
            .SingleOrDefaultAsync(cancellationToken) ?? string.Empty;
        model.ArtifactName = await db.Artifacts
            .Where(x => x.Id == entity.ArtifactId)
            .Select(x => x.Name)
            .SingleOrDefaultAsync(cancellationToken) ?? string.Empty;
        model.AnswerCount = await db.RoundAnswers.CountAsync(x => x.RoundId == id, cancellationToken);
        model.VoteCount = await db.Votes.CountAsync(x => x.RoundId == id, cancellationToken);

        if (model.RoomId.HasValue && await db.GameRounds.AnyAsync(
                x => x.Id != id && x.RoomId == model.RoomId.Value && x.RoundNumber == model.RoundNumber,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.RoundNumber), "同一個房間不能有重複的回合編號");
        }

        if (!TrySetOriginalRowVersion(entity, model.RowVersion))
        {
            ModelState.AddModelError(string.Empty, "版本資訊已失效，請重新載入頁面。");
        }

        if (!ModelState.IsValid)
        {
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            await LoadFormOptionsAsync(model.RoomId, model.ArtifactId, cancellationToken);
            return View(model);
        }

        entity.RoomId = model.RoomId!.Value;
        entity.ArtifactId = model.ArtifactId!.Value;
        entity.RoundNumber = model.RoundNumber;
        entity.Status = model.Status;
        entity.StateVersion = model.StateVersion;
        entity.IsSettled = model.IsSettled;
        entity.StartedAt = ToUtc(model.StartedAt);
        entity.AnswerDeadlineAt = ToUtc(model.AnswerDeadlineAt);
        entity.VotingDeadlineAt = ToUtc(model.VotingDeadlineAt);
        entity.SettledAt = model.IsSettled ? ToUtc(model.SettledAt!.Value) : null;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "回合資料已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "回合資料已被其他操作更新，請重新確認。");
            await db.Entry(entity).ReloadAsync(cancellationToken);
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認回合狀態與時間順序。");
        }

        await LoadFormOptionsAsync(model.RoomId, model.ArtifactId, cancellationToken);
        return View(model);
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.GameRounds
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoundDeleteViewModel
            {
                Id = x.Id,
                RoomCode = x.Room.RoomCode,
                RoundNumber = x.RoundNumber,
                ArtifactName = x.Artifact.Name,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count,
                UnlockCount = db.ArtifactUnlocks.Count(unlock => unlock.GameRoundId == x.Id),
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
        var entity = await db.GameRounds.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        if (await db.RoundAnswers.AnyAsync(x => x.RoundId == id, cancellationToken) ||
            await db.Votes.AnyAsync(x => x.RoundId == id, cancellationToken) ||
            await db.ArtifactUnlocks.AnyAsync(x => x.GameRoundId == id, cancellationToken))
        {
            TempData["Error"] = "已有作答、投票或解鎖紀錄的回合不能刪除，請保留歷史資料。";
            return RedirectToAction(nameof(Details), new { id });
        }

        if (!TrySetOriginalRowVersion(entity, rowVersion))
        {
            TempData["Error"] = "版本資訊已失效，請重新載入頁面。";
            return RedirectToAction(nameof(Delete), new { id });
        }

        db.GameRounds.Remove(entity);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "回合資料已刪除。";
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["Error"] = "回合資料已被其他操作更新，請重新確認。";
        }
        catch (DbUpdateException)
        {
            TempData["Error"] = "回合目前無法刪除，請確認相關紀錄。";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateReferencesAsync(
        RoundFormViewModel model,
        Guid? excludedId,
        CancellationToken cancellationToken)
    {
        model.Status = (model.Status ?? string.Empty).Trim().ToUpperInvariant();
        if (!GameCodeLists.RoundStatuses.ContainsKey(model.Status))
        {
            ModelState.AddModelError(nameof(model.Status), "回合狀態不正確");
        }

        if (!model.RoomId.HasValue || !await db.GameRooms.AnyAsync(x => x.Id == model.RoomId.Value, cancellationToken))
        {
            ModelState.AddModelError(nameof(model.RoomId), "房間不存在");
        }

        if (!model.ArtifactId.HasValue || !await db.Artifacts.AnyAsync(x => x.Id == model.ArtifactId.Value, cancellationToken))
        {
            ModelState.AddModelError(nameof(model.ArtifactId), "文物不存在");
        }
    }

    private async Task LoadRoomOptionsAsync(Guid? selected, CancellationToken cancellationToken)
    {
        var rooms = await db.GameRooms
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, Label = x.RoomCode + " · " + x.Status })
            .ToListAsync(cancellationToken);
        ViewBag.Rooms = new SelectList(rooms, "Id", "Label", selected);
    }

    private async Task LoadFormOptionsAsync(
        Guid? roomId,
        Guid? artifactId,
        CancellationToken cancellationToken)
    {
        await LoadRoomOptionsAsync(roomId, cancellationToken);

        var artifacts = await db.Artifacts
            .AsNoTracking()
            .Where(x => x.IsActive || x.Id == artifactId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, Label = x.Name + "（" + x.ArtifactRef + "）" })
            .ToListAsync(cancellationToken);
        ViewBag.Artifacts = new SelectList(artifacts, "Id", "Label", artifactId);
    }

    private bool TrySetOriginalRowVersion(GameRound entity, string rowVersion)
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

    private static void Normalize(RoundFormViewModel model)
    {
        model.Status = (model.Status ?? string.Empty).Trim().ToUpperInvariant();
    }

    private static DateTime ToUtc(DateTime value)
    {
        return value.Kind == DateTimeKind.Utc
            ? value
            : TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified));
    }

    private static string? NormalizeFilter(string? value, IReadOnlyDictionary<string, string> allowed)
    {
        value = value?.Trim().ToUpperInvariant();
        return !string.IsNullOrWhiteSpace(value) && allowed.ContainsKey(value) ? value : null;
    }

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "room" or "round" or "status" or "answers" => sort.Trim().ToLowerInvariant(),
        _ => "started"
    };
}
