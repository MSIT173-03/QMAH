using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace QMAH.Api.Hubs;

/// <summary>公開社群只接收無內容的變更提示；所有資料仍由原本的公開 API 讀取。</summary>
public sealed class SocialUpdateConnections
{
    private readonly ConcurrentDictionary<string, byte> connections = new();
    public bool HasConnections => !connections.IsEmpty;
    public void Add(string connectionId) => connections.TryAdd(connectionId, 0);
    public void Remove(string connectionId) => connections.TryRemove(connectionId, out _);
}

public sealed class SocialUpdateHub(SocialUpdateConnections connections) : Hub
{
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        connections.Add(Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        connections.Remove(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
