using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Hubs;

/// <summary>
/// 牌桌即時通知。Hub 只負責「這桌有變」的訊號，不傳遊戲內容；
/// 公開房間任何人都能訂閱（觀戰），私人房間只有參與者能訂閱。
/// </summary>
public sealed class GameRoomHub(QmahDbContext db) : Hub
{
    public static string GroupName(Guid roomId) => $"game-room:{roomId:N}";

    public async Task JoinRoom(Guid roomId)
    {
        var room = await db.GameRooms.AsNoTracking()
            .Where(item => item.Id == roomId && item.Status != "CANCELLED")
            .Select(item => new { item.Visibility })
            .SingleOrDefaultAsync(Context.ConnectionAborted);
        if (room is null)
            throw new HubException("找不到遊戲房間");

        if (room.Visibility == "PRIVATE")
        {
            var userIdText = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdText, out var userId)
                || !await db.GamePlayers.AnyAsync(player => player.RoomId == roomId && player.UserId == userId, Context.ConnectionAborted))
            {
                throw new HubException("私人房間只對參與者開放");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(roomId), Context.ConnectionAborted);
    }

    public Task LeaveRoom(Guid roomId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(roomId), Context.ConnectionAborted);
}
