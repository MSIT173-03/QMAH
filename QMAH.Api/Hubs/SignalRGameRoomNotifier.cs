using System.Collections.Concurrent;

using Microsoft.AspNetCore.SignalR;

using QMAH.Infrastructure.Services.Game;

namespace QMAH.Api.Hubs;

/// <summary>
/// 把房間變動推給訂閱者。同一桌 100 毫秒內的多次變動合併成一則，
/// 例如全員同時投票時，每位觀眾只會收到一次通知、重新讀取一次。
/// </summary>
public sealed class SignalRGameRoomNotifier(
    IHubContext<GameRoomHub> hub,
    ILogger<SignalRGameRoomNotifier> logger) : IGameRoomNotifier
{
    private static readonly TimeSpan CoalesceWindow = TimeSpan.FromMilliseconds(100);
    private readonly ConcurrentDictionary<Guid, byte> pending = new();

    public void Changed(Guid roomId)
    {
        if (!pending.TryAdd(roomId, 0))
            return;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(CoalesceWindow);
                pending.TryRemove(roomId, out _);
                await hub.Clients.Group(GameRoomHub.GroupName(roomId)).SendAsync("RoomChanged", roomId);
            }
            catch (Exception exception)
            {
                pending.TryRemove(roomId, out _);
                // 推播失敗不影響遊戲；客戶端另有低頻輪詢作保底。
                logger.LogWarning(exception, "推播房間 {RoomId} 變動失敗。", roomId);
            }
        });
    }
}
