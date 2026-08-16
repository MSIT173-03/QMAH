using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("房間", order: 20)]
public sealed class RoomsController(
    QmahDbContext db,
    IPasswordHasher<GameRoom> passwordHasher) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        string? status,
        string? visibility,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        status = NormalizeFilter(status, GameCodeLists.RoomStatuses);
        visibility = NormalizeFilter(visibility, GameCodeLists.Visibilities);
        sort = NormalizeSort(sort, "created");

        var query = db.GameRooms.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.RoomCode.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(visibility))
        {
            query = query.Where(x => x.Visibility == visibility);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = sort switch
        {
            "code" => query.OrderBy(x => x.RoomCode).ThenByDescending(x => x.CreatedAt),
            "status" => query.OrderBy(x => x.Status).ThenByDescending(x => x.CreatedAt),
            "players" => query.OrderByDescending(x => x.GamePlayers.Count).ThenByDescending(x => x.CreatedAt),
            "rounds" => query.OrderByDescending(x => x.GameRounds.Count).ThenByDescending(x => x.CreatedAt),
            _ => query.OrderByDescending(x => x.CreatedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new RoomListItemViewModel
            {
                Id = x.Id,
                RoomCode = x.RoomCode,
                Status = x.Status,
                Visibility = x.Visibility,
                MaxPlayers = x.MaxPlayers,
                CurrentRoundNo = x.CurrentRoundNo,
                TotalRounds = x.TotalRounds,
                PlayerCount = x.GamePlayers.Count,
                RoundCount = x.GameRounds.Count,
                CreatedAt = x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return View(new RoomIndexViewModel
        {
            Search = search,
            Status = status,
            Visibility = visibility,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<RoomListItemViewModel>
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
        var model = await db.GameRooms
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoomDetailsViewModel
            {
                Id = x.Id,
                RoomCode = x.RoomCode,
                Status = x.Status,
                Visibility = x.Visibility,
                MaxPlayers = x.MaxPlayers,
                CurrentRoundNo = x.CurrentRoundNo,
                TotalRounds = x.TotalRounds,
                PlayerCount = x.GamePlayers.Count,
                RoundCount = x.GameRounds.Count,
                CreatedAt = x.CreatedAt,
                AnswerSeconds = x.AnswerSeconds,
                VotingSeconds = x.VotingSeconds,
                CategoryFilterCode = x.CategoryFilterCode,
                CategoryFilterName = db.ArtifactCategories
                    .Where(category => category.Code == x.CategoryFilterCode)
                    .Select(category => category.Name)
                    .FirstOrDefault(),
                EraBucketFilterCode = x.EraBucketFilterCode,
                EraBucketFilterName = db.EraBuckets
                    .Where(era => era.Code == x.EraBucketFilterCode)
                    .Select(era => era.Name)
                    .FirstOrDefault(),
                StateVersion = x.StateVersion,
                RowVersion = Convert.ToBase64String(x.RowVersion),
                StartedAt = x.StartedAt,
                EndedAt = x.EndedAt,
                CompletedAt = x.CompletedAt,
                Players = x.GamePlayers
                    .OrderBy(p => p.SeatNo)
                    .ThenBy(p => p.JoinedAt)
                    .Select(p => new RoomPlayerItemViewModel
                    {
                        Id = p.Id,
                        DisplayName = p.DisplayName,
                        Role = p.Role,
                        ConnectionStatus = p.ConnectionStatus,
                        IsReady = p.IsReady,
                        SeatNo = p.SeatNo
                    })
                    .ToList(),
                Rounds = x.GameRounds
                    .OrderBy(r => r.RoundNumber)
                    .Select(r => new RoomRoundItemViewModel
                    {
                        Id = r.Id,
                        RoundNumber = r.RoundNumber,
                        ArtifactName = r.Artifact.Name,
                        Status = r.Status,
                        AnswerCount = r.RoundAnswers.Count,
                        VoteCount = r.Votes.Count
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(CancellationToken cancellationToken)
    {
        await LoadFilterOptionsAsync(null, null, cancellationToken);
        return View(new RoomCreateViewModel());
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        RoomCreateViewModel model,
        CancellationToken cancellationToken)
    {
        Normalize(model);
        await ValidateCodesAsync(model, cancellationToken);

        if (await db.GameRooms.AnyAsync(x => x.RoomCode == model.RoomCode, cancellationToken))
        {
            ModelState.AddModelError(nameof(model.RoomCode), "房間代碼已存在");
        }

        if (!ModelState.IsValid)
        {
            await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
            return View(model);
        }

        var entity = new GameRoom
        {
            Id = Guid.NewGuid(),
            RoomCode = model.RoomCode,
            Status = "WAITING",
            Visibility = model.Visibility,
            MaxPlayers = model.MaxPlayers,
            TotalRounds = model.TotalRounds,
            AnswerSeconds = model.AnswerSeconds,
            VotingSeconds = model.VotingSeconds,
            CategoryFilterCode = model.CategoryFilterCode,
            EraBucketFilterCode = model.EraBucketFilterCode,
            CurrentRoundNo = 0,
            StateVersion = 0,
            CreatedAt = DateTime.UtcNow
        };

        entity.PasswordHash = model.Visibility == "PRIVATE"
            ? passwordHasher.HashPassword(entity, model.Password!)
            : null;

        db.GameRooms.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "房間已建立。";
            return RedirectToAction(nameof(Details), new { id = entity.Id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認房間代碼與篩選條件。");
            await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.GameRooms
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound();
        }

        var model = new RoomEditViewModel
        {
            Id = entity.Id,
            RoomCode = entity.RoomCode,
            Status = entity.Status,
            Visibility = entity.Visibility,
            MaxPlayers = entity.MaxPlayers,
            TotalRounds = entity.TotalRounds,
            AnswerSeconds = entity.AnswerSeconds,
            VotingSeconds = entity.VotingSeconds,
            CategoryFilterCode = entity.CategoryFilterCode,
            EraBucketFilterCode = entity.EraBucketFilterCode,
            RowVersion = Convert.ToBase64String(entity.RowVersion)
        };

        await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        RoomEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        Normalize(model);
        await ValidateCodesAsync(model, cancellationToken);

        var entity = await db.GameRooms.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        model.Status = entity.Status;

        if (entity.Status != "WAITING")
        {
            ModelState.AddModelError(string.Empty, "只有等待中的房間可以修改設定。");
        }

        if (await db.GameRooms.AnyAsync(
                x => x.Id != id && x.RoomCode == model.RoomCode,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.RoomCode), "房間代碼已存在");
        }

        if (!TrySetOriginalRowVersion(entity, model.RowVersion))
        {
            ModelState.AddModelError(string.Empty, "版本資訊已失效，請重新載入頁面。");
        }

        if (!ModelState.IsValid)
        {
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
            return View(model);
        }

        entity.RoomCode = model.RoomCode;
        entity.Visibility = model.Visibility;
        entity.MaxPlayers = model.MaxPlayers;
        entity.TotalRounds = model.TotalRounds;
        entity.AnswerSeconds = model.AnswerSeconds;
        entity.VotingSeconds = model.VotingSeconds;
        entity.CategoryFilterCode = model.CategoryFilterCode;
        entity.EraBucketFilterCode = model.EraBucketFilterCode;

        if (model.Visibility == "PUBLIC")
        {
            entity.PasswordHash = null;
        }
        else if (!string.IsNullOrWhiteSpace(model.Password))
        {
            entity.PasswordHash = passwordHasher.HashPassword(entity, model.Password);
        }
        else if (string.IsNullOrWhiteSpace(entity.PasswordHash))
        {
            ModelState.AddModelError(nameof(model.Password), "私人房間必須設定密碼");
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
            return View(model);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "房間設定已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "房間已被其他操作更新，請重新確認最新資料。");
            await db.Entry(entity).ReloadAsync(cancellationToken);
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認輸入內容。");
        }

        await LoadFilterOptionsAsync(model.CategoryFilterCode, model.EraBucketFilterCode, cancellationToken);
        return View(model);
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var data = await db.GameRooms
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.RoomCode,
                x.RowVersion,
                x.Status,
                PlayerCount = x.GamePlayers.Count,
                RoundCount = x.GameRounds.Count
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (data is null)
        {
            return NotFound();
        }

        return View(new RoomDeleteViewModel
        {
            Id = data.Id,
            RoomCode = data.RoomCode,
            PlayerCount = data.PlayerCount,
            RoundCount = data.RoundCount,
            RowVersion = Convert.ToBase64String(data.RowVersion),
            CanDelete = data.Status == "WAITING" && data.PlayerCount == 0 && data.RoundCount == 0
        });
    }

    [HttpPost, ActionName("Delete")]
    public async Task<IActionResult> DeleteConfirmed(
        Guid id,
        string rowVersion,
        CancellationToken cancellationToken)
    {
        var entity = await db.GameRooms
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        if (entity.Status != "WAITING" ||
            await db.GamePlayers.AnyAsync(x => x.RoomId == id, cancellationToken) ||
            await db.GameRounds.AnyAsync(x => x.RoomId == id, cancellationToken))
        {
            TempData["Error"] = "只有沒有玩家與回合的等待中房間可以刪除。";
            return RedirectToAction(nameof(Details), new { id });
        }

        if (!TrySetOriginalRowVersion(entity, rowVersion))
        {
            TempData["Error"] = "版本資訊已失效，請重新確認房間狀態。";
            return RedirectToAction(nameof(Delete), new { id });
        }

        db.GameRooms.Remove(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "房間已刪除。";
            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["Error"] = "房間已被其他操作更新，請重新確認。";
            return RedirectToAction(nameof(Index));
        }
    }

    private static void Normalize(RoomFormViewModel model)
    {
        model.RoomCode = (model.RoomCode ?? string.Empty).Trim().ToUpperInvariant();
        model.Visibility = (model.Visibility ?? string.Empty).Trim().ToUpperInvariant();
        model.CategoryFilterCode = NullIfWhiteSpace(model.CategoryFilterCode)?.ToUpperInvariant();
        model.EraBucketFilterCode = NullIfWhiteSpace(model.EraBucketFilterCode)?.ToUpperInvariant();
    }

    private async Task ValidateCodesAsync(RoomFormViewModel model, CancellationToken cancellationToken)
    {
        if (!GameCodeLists.Visibilities.ContainsKey(model.Visibility))
        {
            ModelState.AddModelError(nameof(model.Visibility), "可見範圍不正確");
        }

        if (model.CategoryFilterCode is not null && !await db.ArtifactCategories
                .AsNoTracking()
                .AnyAsync(x => x.Code == model.CategoryFilterCode, cancellationToken))
        {
            ModelState.AddModelError(nameof(model.CategoryFilterCode), "限定分類不存在");
        }

        if (model.EraBucketFilterCode is not null && !await db.EraBuckets
                .AsNoTracking()
                .AnyAsync(x => x.Code == model.EraBucketFilterCode, cancellationToken))
        {
            ModelState.AddModelError(nameof(model.EraBucketFilterCode), "限定年代不存在");
        }
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private bool TrySetOriginalRowVersion(GameRoom entity, string rowVersion)
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

    private async Task LoadFilterOptionsAsync(
        string? categoryCode,
        string? eraCode,
        CancellationToken cancellationToken)
    {
        ViewBag.Categories = new SelectList(
            await db.ArtifactCategories.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
            "Code",
            "Name",
            categoryCode);
        ViewBag.Eras = new SelectList(
            await db.EraBuckets.AsNoTracking().OrderBy(x => x.StartYear).ThenBy(x => x.Name).ToListAsync(cancellationToken),
            "Code",
            "Name",
            eraCode);
    }

    private static string? NormalizeFilter(string? value, IReadOnlyDictionary<string, string> allowed)
    {
        value = value?.Trim().ToUpperInvariant();
        return !string.IsNullOrWhiteSpace(value) && allowed.ContainsKey(value) ? value : null;
    }

    private static string NormalizeSort(string? sort, string fallback) => sort?.Trim().ToLowerInvariant() switch
    {
        "code" or "status" or "players" or "rounds" => sort.Trim().ToLowerInvariant(),
        _ => fallback
    };
}
