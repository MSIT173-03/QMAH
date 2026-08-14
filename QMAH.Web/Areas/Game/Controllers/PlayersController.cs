using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("玩家", order: 30)]
public sealed class PlayersController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        string? connectionStatus,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        connectionStatus = NormalizeFilter(connectionStatus, GameCodeLists.ConnectionStatuses);
        sort = NormalizeSort(sort);

        var query = db.GamePlayers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.DisplayName.Contains(search) ||
                x.PlayerKey.Contains(search) ||
                x.Room.RoomCode.Contains(search) ||
                (x.User.UserName != null && x.User.UserName.Contains(search)) ||
                (x.User.Email != null && x.User.Email.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(connectionStatus))
        {
            query = query.Where(x => x.ConnectionStatus == connectionStatus);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = sort switch
        {
            "name" => query.OrderBy(x => x.DisplayName).ThenByDescending(x => x.JoinedAt),
            "room" => query.OrderBy(x => x.Room.RoomCode).ThenBy(x => x.DisplayName),
            "status" => query.OrderBy(x => x.ConnectionStatus).ThenByDescending(x => x.LastSeenAt),
            "seat" => query.OrderBy(x => x.Room.RoomCode).ThenBy(x => x.SeatNo).ThenBy(x => x.DisplayName),
            _ => query.OrderByDescending(x => x.JoinedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PlayerListItemViewModel
            {
                Id = x.Id,
                RoomId = x.RoomId,
                RoomCode = x.Room.RoomCode,
                DisplayName = x.DisplayName,
                UserName = x.User.UserName,
                Email = x.User.Email,
                Role = x.Role,
                ConnectionStatus = x.ConnectionStatus,
                IsReady = x.IsReady,
                SeatNo = x.SeatNo,
                JoinedAt = x.JoinedAt
            })
            .ToListAsync(cancellationToken);

        return View(new PlayerIndexViewModel
        {
            Search = search,
            ConnectionStatus = connectionStatus,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<PlayerListItemViewModel>
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
        var model = await db.GamePlayers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new PlayerDetailsViewModel
            {
                Id = x.Id,
                RoomId = x.RoomId,
                RoomCode = x.Room.RoomCode,
                DisplayName = x.DisplayName,
                UserName = x.User.UserName,
                Email = x.User.Email,
                PlayerKey = x.PlayerKey,
                Role = x.Role,
                ConnectionStatus = x.ConnectionStatus,
                IsReady = x.IsReady,
                SeatNo = x.SeatNo,
                JoinedAt = x.JoinedAt,
                LastSeenAt = x.LastSeenAt,
                DisconnectedAt = x.DisconnectedAt,
                ReconnectDeadlineAt = x.ReconnectDeadlineAt,
                LeftAt = x.LeftAt,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(Guid? roomId, CancellationToken cancellationToken)
    {
        await LoadOptionsAsync(roomId, null, cancellationToken);
        return View(new PlayerCreateViewModel { RoomId = roomId });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        PlayerCreateViewModel model,
        CancellationToken cancellationToken)
    {
        Normalize(model);
        ValidateCodes(model);

        var room = model.RoomId.HasValue
            ? await db.GameRooms.SingleOrDefaultAsync(x => x.Id == model.RoomId.Value, cancellationToken)
            : null;
        if (room is null)
        {
            ModelState.AddModelError(nameof(model.RoomId), "房間不存在");
        }

        var userExists = model.UserId.HasValue && await db.Users.AnyAsync(x => x.Id == model.UserId.Value, cancellationToken);
        if (!userExists)
        {
            ModelState.AddModelError(nameof(model.UserId), "會員不存在");
        }

        if (model.RoomId.HasValue && await db.GamePlayers.AnyAsync(
                x => x.RoomId == model.RoomId.Value && x.PlayerKey == model.PlayerKey,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.PlayerKey), "這個房間已經有相同的玩家識別碼");
        }

        if (model.RoomId.HasValue && model.UserId.HasValue && await db.GamePlayers.AnyAsync(
                x => x.RoomId == model.RoomId.Value && x.UserId == model.UserId.Value,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.UserId), "這個會員已經在該房間中");
        }

        await ValidateRoleAndSeatAsync(model.Role, model.SeatNo, model.RoomId, null, cancellationToken);

        if (!ModelState.IsValid)
        {
            await LoadOptionsAsync(model.RoomId, model.UserId, cancellationToken);
            return View(model);
        }

        var now = DateTime.UtcNow;
        var entity = new GamePlayer
        {
            Id = Guid.NewGuid(),
            RoomId = model.RoomId!.Value,
            UserId = model.UserId!.Value,
            PlayerKey = model.PlayerKey,
            DisplayName = model.DisplayName,
            Role = model.Role,
            IsReady = model.IsReady,
            SeatNo = model.SeatNo,
            JoinedAt = now,
            LastSeenAt = now
        };
        ApplyConnectionState(entity, model.ConnectionStatus, now, model.IsReady);
        db.GamePlayers.Add(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "玩家資料已建立。";
            return RedirectToAction(nameof(Details), new { id = entity.Id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認房間、會員、識別碼與座位沒有重複。");
            await LoadOptionsAsync(model.RoomId, model.UserId, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.GamePlayers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new PlayerEditViewModel
            {
                Id = x.Id,
                RoomCode = x.Room.RoomCode,
                UserName = x.User.UserName ?? x.User.Email ?? x.UserId.ToString(),
                PlayerKey = x.PlayerKey,
                DisplayName = x.DisplayName,
                Role = x.Role,
                IsReady = x.IsReady,
                SeatNo = x.SeatNo,
                ConnectionStatus = x.ConnectionStatus,
                AnswerCount = x.RoundAnswers.Count,
                VoteCount = x.Votes.Count,
                RowVersion = Convert.ToBase64String(x.RowVersion)
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        PlayerEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        Normalize(model);
        ValidateCodes(model);

        var entity = await db.GamePlayers
            .Include(x => x.Room)
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        model.RoomCode = entity.Room.RoomCode;
        model.UserName = entity.User.UserName ?? entity.User.Email ?? entity.UserId.ToString();
        model.AnswerCount = await db.RoundAnswers.CountAsync(x => x.GamePlayerId == id, cancellationToken);
        model.VoteCount = await db.Votes.CountAsync(x => x.VoterGamePlayerId == id, cancellationToken);

        if (await db.GamePlayers.AnyAsync(
                x => x.Id != id && x.RoomId == entity.RoomId && x.PlayerKey == model.PlayerKey,
                cancellationToken))
        {
            ModelState.AddModelError(nameof(model.PlayerKey), "這個房間已經有相同的玩家識別碼");
        }

        await ValidateRoleAndSeatAsync(model.Role, model.SeatNo, entity.RoomId, id, cancellationToken);

        if (!TrySetOriginalRowVersion(entity, model.RowVersion))
        {
            ModelState.AddModelError(string.Empty, "版本資訊已失效，請重新載入頁面。");
        }

        if (!ModelState.IsValid)
        {
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            return View(model);
        }

        entity.PlayerKey = model.PlayerKey;
        entity.DisplayName = model.DisplayName;
        entity.Role = model.Role;
        entity.SeatNo = model.SeatNo;
        ApplyConnectionState(entity, model.ConnectionStatus, DateTime.UtcNow, model.IsReady);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "玩家資料已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "玩家資料已被其他操作更新，請重新確認。");
            await db.Entry(entity).ReloadAsync(cancellationToken);
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            return View(model);
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認角色、座位與狀態。");
            model.RowVersion = Convert.ToBase64String(entity.RowVersion);
            return View(model);
        }
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.GamePlayers
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new PlayerDeleteViewModel
            {
                Id = x.Id,
                RoomCode = x.Room.RoomCode,
                DisplayName = x.DisplayName,
                PlayerKey = x.PlayerKey,
                AnswerCount = x.RoundAnswers.Count,
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
        var entity = await db.GamePlayers.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        if (await db.RoundAnswers.AnyAsync(x => x.GamePlayerId == id, cancellationToken) ||
            await db.Votes.AnyAsync(x => x.VoterGamePlayerId == id, cancellationToken))
        {
            TempData["Error"] = "已有作答或投票紀錄的玩家不能刪除，請保留歷史資料。";
            return RedirectToAction(nameof(Details), new { id });
        }

        if (!TrySetOriginalRowVersion(entity, rowVersion))
        {
            TempData["Error"] = "版本資訊已失效，請重新載入頁面。";
            return RedirectToAction(nameof(Delete), new { id });
        }

        db.GamePlayers.Remove(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "玩家資料已刪除。";
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["Error"] = "玩家資料已被其他操作更新，請重新確認。";
        }
        catch (DbUpdateException)
        {
            TempData["Error"] = "玩家資料目前無法刪除，請確認相關紀錄。";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateRoleAndSeatAsync(
        string role,
        byte? seatNo,
        Guid? roomId,
        Guid? excludedId,
        CancellationToken cancellationToken)
    {
        if (role == "HOST" && roomId.HasValue && await db.GamePlayers.AnyAsync(
                x => x.RoomId == roomId.Value && x.Role == "HOST" && (!excludedId.HasValue || x.Id != excludedId.Value),
                cancellationToken))
        {
            ModelState.AddModelError(nameof(PlayerFormViewModel.Role), "同一個房間只能有一位房主");
        }

        if (seatNo.HasValue && roomId.HasValue && await db.GamePlayers.AnyAsync(
                x => x.RoomId == roomId.Value && x.SeatNo == seatNo && (!excludedId.HasValue || x.Id != excludedId.Value),
                cancellationToken))
        {
            ModelState.AddModelError(nameof(PlayerFormViewModel.SeatNo), "這個座位已被其他玩家使用");
        }
    }

    private static void Normalize(PlayerFormViewModel model)
    {
        model.PlayerKey = (model.PlayerKey ?? string.Empty).Trim();
        model.DisplayName = (model.DisplayName ?? string.Empty).Trim();
        model.Role = (model.Role ?? string.Empty).Trim().ToUpperInvariant();
        model.ConnectionStatus = (model.ConnectionStatus ?? string.Empty).Trim().ToUpperInvariant();
    }

    private void ValidateCodes(PlayerFormViewModel model)
    {
        if (!GameCodeLists.PlayerRoles.ContainsKey(model.Role))
        {
            ModelState.AddModelError(nameof(model.Role), "玩家角色不正確");
        }
        if (!GameCodeLists.ConnectionStatuses.ContainsKey(model.ConnectionStatus))
        {
            ModelState.AddModelError(nameof(model.ConnectionStatus), "連線狀態不正確");
        }
    }

    private static void ApplyConnectionState(GamePlayer entity, string status, DateTime now, bool isReady)
    {
        entity.ConnectionStatus = status;
        entity.IsReady = status == "LEFT" ? false : isReady;
        entity.LastSeenAt = entity.LastSeenAt > now ? entity.LastSeenAt : now;
        entity.DisconnectedAt = status == "OFFLINE" ? entity.LastSeenAt : null;
        entity.ReconnectDeadlineAt = status == "OFFLINE" ? entity.LastSeenAt.AddMinutes(2) : null;
        entity.LeftAt = status == "LEFT" ? entity.LastSeenAt : null;
    }

    private bool TrySetOriginalRowVersion(GamePlayer entity, string rowVersion)
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

    private async Task LoadOptionsAsync(Guid? roomId, Guid? userId, CancellationToken cancellationToken)
    {
        var rooms = await db.GameRooms
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, Label = x.RoomCode + " · " + x.Status })
            .ToListAsync(cancellationToken);
        ViewBag.Rooms = new SelectList(rooms, "Id", "Label", roomId);

        var users = await db.Users
            .AsNoTracking()
            .OrderBy(x => x.UserName)
            .Select(x => new
            {
                x.Id,
                Label = (x.UserName ?? x.Email ?? x.Id.ToString()) + (x.Email == null ? string.Empty : " · " + x.Email)
            })
            .ToListAsync(cancellationToken);
        ViewBag.Users = new SelectList(users, "Id", "Label", userId);
    }

    private static string? NormalizeFilter(string? value, IReadOnlyDictionary<string, string> allowed)
    {
        value = value?.Trim().ToUpperInvariant();
        return !string.IsNullOrWhiteSpace(value) && allowed.ContainsKey(value) ? value : null;
    }

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "name" or "room" or "status" or "seat" => sort.Trim().ToLowerInvariant(),
        _ => "joined"
    };
}
