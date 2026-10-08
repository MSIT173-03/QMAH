using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace QMAH.Api.Hubs;

public sealed class NotificationConnections
{
    private readonly ConcurrentDictionary<string, Guid> connections = new();
    public Guid[] Users => connections.Values.Distinct().ToArray();
    public void Add(string connectionId, Guid userId) => connections[connectionId] = userId;
    public void Remove(string connectionId) => connections.TryRemove(connectionId, out _);
}

[Authorize]
public sealed class NotificationHub(NotificationConnections connections) : Hub
{
    public override async Task OnConnectedAsync()
    {
        if (!Guid.TryParse(Context.UserIdentifier, out var userId))
        {
            Context.Abort();
            return;
        }
        connections.Add(Context.ConnectionId, userId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        connections.Remove(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
