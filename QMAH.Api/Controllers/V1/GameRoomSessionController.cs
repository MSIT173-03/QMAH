using System.ComponentModel.DataAnnotations;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Services.Game;

namespace QMAH.Api.Controllers.V1;

[Authorize]
[Route("api/v1/game/rooms/{id:guid}/presentation")]
public sealed class GameRoomSessionController(
    QmahDbContext db,
    GameRoomSessionStore sessionStore) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<GameRoomPresentation>(StatusCodes.Status200OK)]
    public async Task<ActionResult<GameRoomPresentation>> GetPresentation(
        Guid id,
        Guid? connectionId = null,
        CancellationToken cancellationToken = default)
    {
        var access = await FindParticipantAsync(id, allowCompletedHistory: true, cancellationToken);
        if (access.Error is not null)
            return access.Error;

        var room = access.Room!;
        var players = ToSessionPlayers(room.GamePlayers);
        if (connectionId.HasValue)
        {
            if (connectionId.Value == Guid.Empty)
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "連線識別碼無效");
            if (room.Status is "WAITING" or "PLAYING")
                sessionStore.TouchConnection(room.Id, players, access.Player!.Id, connectionId.Value, room.Status);
        }

        var presentation = sessionStore.GetPresentation(room.Id, players, room.Status, room.CompletedAt);
        return presentation is null
            ? sessionStore.IsAtCapacity
                ? Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "房間暫存容量已滿", detail: "請稍後重試。")
                : Problem(statusCode: StatusCodes.Status404NotFound, title: "房間暫存狀態已過期")
            : Ok(presentation);
    }

    [HttpDelete("connections/{connectionId:guid}")]
    public async Task<IActionResult> Disconnect(
        Guid id,
        Guid connectionId,
        CancellationToken cancellationToken = default)
    {
        if (connectionId == Guid.Empty)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "連線識別碼無效");

        var access = await FindParticipantAsync(
            id, allowCompletedHistory: false, cancellationToken, allowLeftParticipant: true);
        if (access.Error is not null)
            return access.Error;

        sessionStore.DisconnectConnection(id, access.Player!.Id, connectionId);
        return NoContent();
    }

    [HttpPost("chat")]
    [ProducesResponseType<GameRoomSessionMessage>(StatusCodes.Status200OK)]
    public async Task<ActionResult<GameRoomSessionMessage>> SendMessage(
        Guid id,
        [FromBody] GameRoomChatRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        var access = await FindParticipantAsync(id, allowCompletedHistory: false, cancellationToken);
        if (access.Error is not null)
            return access.Error;

        if (request.ClientMessageId == Guid.Empty)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "訊息識別碼無效");

        var text = request.Text?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 500)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "訊息長度無效", detail: "訊息需為 1 至 500 字純文字。");

        var room = access.Room!;
        var player = access.Player!;
        var result = sessionStore.TrySendMessage(
            room.Id,
            ToSessionPlayers(room.GamePlayers),
            player.Id,
            player.DisplayName,
            text,
            request.ClientMessageId,
            room.Status,
            room.CompletedAt);

        return result.Status switch
        {
            GameRoomSessionResultStatus.Success => Ok(result.Message),
            GameRoomSessionResultStatus.RateLimited => TooManyMessages(result.RetryAfter),
            GameRoomSessionResultStatus.CapacityReached => Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "房間暫存容量已滿", detail: "請稍後重試。"),
            GameRoomSessionResultStatus.Expired => Problem(statusCode: StatusCodes.Status404NotFound, title: "房間暫存狀態已過期"),
            _ => Problem(statusCode: StatusCodes.Status409Conflict, title: "房間目前不接受訊息")
        };
    }

    [HttpPut("color")]
    [ProducesResponseType<GameRoomPresentation>(StatusCodes.Status200OK)]
    public async Task<ActionResult<GameRoomPresentation>> SetColor(
        Guid id,
        [FromBody] GameRoomColorRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = await FindParticipantAsync(id, allowCompletedHistory: false, cancellationToken);
        if (access.Error is not null)
            return access.Error;

        var room = access.Room!;
        var result = sessionStore.TrySetColor(
            room.Id,
            ToSessionPlayers(room.GamePlayers),
            access.Player!.Id,
            request.Color,
            room.Status,
            room.CompletedAt);

        return result.Status switch
        {
            GameRoomSessionResultStatus.Success => Ok(result.Presentation),
            GameRoomSessionResultStatus.CapacityReached => Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "房間暫存容量已滿", detail: "請稍後重試。"),
            GameRoomSessionResultStatus.Expired => Problem(statusCode: StatusCodes.Status404NotFound, title: "房間暫存狀態已過期"),
            _ => Problem(statusCode: StatusCodes.Status409Conflict, title: "顏色無效、已被使用，或房間已開始")
        };
    }

    private async Task<ParticipantAccess> FindParticipantAsync(
        Guid roomId,
        bool allowCompletedHistory,
        CancellationToken cancellationToken,
        bool allowLeftParticipant = false)
    {
        if (!TryGetCurrentUserId(out var userId))
            return new ParticipantAccess(null, null, Unauthorized());

        var room = await db.GameRooms.AsNoTracking()
            .Include(item => item.GamePlayers)
            .SingleOrDefaultAsync(item => item.Id == roomId, cancellationToken);
        if (room is null)
            return new ParticipantAccess(null, null, Problem(statusCode: StatusCodes.Status404NotFound, title: "找不到遊戲房間"));

        var player = room.GamePlayers.SingleOrDefault(item => item.UserId == userId);
        if (player is null)
            return new ParticipantAccess(null, null, Forbid());

        if (room.Status == "COMPLETED" && allowCompletedHistory)
            return new ParticipantAccess(room, player, null);

        if (room.Status is "WAITING" or "PLAYING")
        {
            if (player.ConnectionStatus == "LEFT" && !allowLeftParticipant)
                return new ParticipantAccess(null, null, Forbid());
            return new ParticipantAccess(room, player, null);
        }

        return new ParticipantAccess(null, null, Problem(statusCode: StatusCodes.Status409Conflict, title: "房間目前不可使用"));
    }

    private static IReadOnlyCollection<GameRoomSessionPlayer> ToSessionPlayers(
        IEnumerable<GamePlayer> players) =>
        players.Select(player => new GameRoomSessionPlayer(player.Id, player.SeatNo ?? 0, player.DisplayName)).ToArray();

    private ActionResult TooManyMessages(TimeSpan? retryAfter)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling((retryAfter ?? TimeSpan.FromSeconds(2)).TotalSeconds));
        Response.Headers.RetryAfter = seconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "發送太頻繁", detail: "請稍後再傳送訊息。");
    }

    private sealed record ParticipantAccess(
        GameRoom? Room,
        GamePlayer? Player,
        ActionResult? Error);
}

public sealed class GameRoomChatRequest
{
    [Required]
    [StringLength(500, MinimumLength = 1)]
    public string Text { get; set; } = "";

    [Required]
    public Guid ClientMessageId { get; set; }
}

public sealed class GameRoomColorRequest
{
    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string Color { get; set; } = "";
}
