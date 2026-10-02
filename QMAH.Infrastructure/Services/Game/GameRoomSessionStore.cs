using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Internal;

namespace QMAH.Infrastructure.Services.Game;

public sealed record GameRoomSessionPlayer(Guid GamePlayerId, int SeatNo, string DisplayName);

public sealed record GameRoomSessionMessage(
    Guid Id,
    Guid GamePlayerId,
    string DisplayName,
    string Text,
    DateTimeOffset SentAt);

public sealed record GameRoomPresentation(
    Dictionary<string, string> Colors,
    IReadOnlyList<GameRoomSessionMessage> Messages);

public enum GameRoomSessionResultStatus
{
    Success,
    Conflict,
    RateLimited,
    CapacityReached,
    Expired
}

public sealed record GameRoomSessionResult(
    GameRoomSessionResultStatus Status,
    GameRoomPresentation? Presentation = null,
    GameRoomSessionMessage? Message = null,
    TimeSpan? RetryAfter = null);

/// <summary>短期房間展示狀態，只存在目前 API 程序的記憶體快取。</summary>
public sealed class GameRoomSessionStore : IDisposable
{
    public const int MaximumRooms = 256;
    public const int MaximumMessagesPerRoom = 100;
    public static readonly TimeSpan IdleLifetime = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan ActiveAbsoluteLifetime = TimeSpan.FromHours(6);
    public static readonly TimeSpan CompletedReadLifetime = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan ChatRateLimit = TimeSpan.FromSeconds(2);
    public static readonly TimeSpan ConnectionLeaseLifetime = TimeSpan.FromSeconds(45);
    public static readonly TimeSpan ConnectionHeartbeatInterval = TimeSpan.FromSeconds(15);
    public static readonly TimeSpan ConnectionSweepInterval = TimeSpan.FromSeconds(10);

    private static readonly string[] ColorCodes =
    [
        "jade", "blue", "vermilion", "gold", "violet", "teal",
        "rose", "slate", "olive", "copper", "indigo", "sand"
    ];
    public static IReadOnlyList<string> ColorPalette { get; } = Array.AsReadOnly(ColorCodes);

    private readonly MemoryCache _cache;
    private readonly TimeProvider _timeProvider;
    private readonly object _roomsGate = new();
    private readonly Dictionary<Guid, RoomSession> _trackedRooms = [];
    private readonly int _roomCapacity;
    private readonly TimeSpan _idleLifetime;
    private readonly TimeSpan _activeAbsoluteLifetime;
    private readonly TimeSpan _completedReadLifetime;
    private readonly Timer _connectionSweepTimer;

    public GameRoomSessionStore(
        TimeProvider? timeProvider = null,
        int roomCapacity = MaximumRooms,
        TimeSpan? idleLifetime = null,
        TimeSpan? activeAbsoluteLifetime = null,
        TimeSpan? completedReadLifetime = null)
    {
        if (roomCapacity is < 1 or > MaximumRooms)
            throw new ArgumentOutOfRangeException(nameof(roomCapacity));

        _timeProvider = timeProvider ?? TimeProvider.System;
        _roomCapacity = roomCapacity;
        _idleLifetime = idleLifetime ?? IdleLifetime;
        _activeAbsoluteLifetime = activeAbsoluteLifetime ?? ActiveAbsoluteLifetime;
        _completedReadLifetime = completedReadLifetime ?? CompletedReadLifetime;
        _cache = new MemoryCache(new MemoryCacheOptions
        {
            SizeLimit = MaximumRooms,
#pragma warning disable CS0618
            Clock = new TimeProviderSystemClock(_timeProvider)
#pragma warning restore CS0618
        });
        _connectionSweepTimer = new Timer(
            _ => SweepExpiredConnections(),
            null,
            ConnectionSweepInterval,
            ConnectionSweepInterval);
    }

    public int TrackedRoomCount
    {
        get
        {
            lock (_roomsGate)
            {
                PruneExpiredRoomKeys();
                return _trackedRooms.Count;
            }
        }
    }

    public bool IsAtCapacity
    {
        get
        {
            lock (_roomsGate)
            {
                PruneExpiredRoomKeys();
                return _trackedRooms.Count >= _roomCapacity;
            }
        }
    }

    public GameRoomPresentation? GetPresentation(
        Guid roomId,
        IReadOnlyCollection<GameRoomSessionPlayer> players,
        string roomStatus,
        DateTime? completedAt = null)
    {
        while (true)
        {
            var session = GetSession(roomId, players, roomStatus, completedAt);
            if (session is null)
                return null;

            lock (session.Gate)
            {
                if (!IsCurrentSession(roomId, session))
                    continue;

                session.LastTouchedAt = _timeProvider.GetUtcNow();
                EnsurePlayerColors(session, players);
                return CreatePresentation(session);
            }
        }
    }

    public GameRoomSessionResult TrySendMessage(
        Guid roomId,
        IReadOnlyCollection<GameRoomSessionPlayer> players,
        Guid gamePlayerId,
        string displayName,
        string text,
        Guid clientMessageId,
        string roomStatus,
        DateTime? completedAt = null)
    {
        while (true)
        {
            var session = GetSession(roomId, players, roomStatus, completedAt);
            if (session is null)
                return new GameRoomSessionResult(IsAtCapacity
                    ? GameRoomSessionResultStatus.CapacityReached
                    : GameRoomSessionResultStatus.Expired);

            lock (session.Gate)
            {
                if (!IsCurrentSession(roomId, session))
                    continue;

                if (session.CompletedAt.HasValue || roomStatus is not ("WAITING" or "PLAYING"))
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Conflict);

                EnsurePlayerColors(session, players);
                var dedupeKey = (gamePlayerId, clientMessageId);
                if (session.MessagesByClientId.TryGetValue(dedupeKey, out var existing))
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Success, CreatePresentation(session), existing);

                var now = _timeProvider.GetUtcNow();
                if (session.LastMessageAt.TryGetValue(gamePlayerId, out var lastMessageAt))
                {
                    var elapsed = now - lastMessageAt;
                    if (elapsed < ChatRateLimit)
                        return new GameRoomSessionResult(
                            GameRoomSessionResultStatus.RateLimited,
                            RetryAfter: ChatRateLimit - elapsed);
                }

                if (session.Messages.Count >= MaximumMessagesPerRoom)
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Conflict);

                var message = new GameRoomSessionMessage(
                    Guid.NewGuid(), gamePlayerId, displayName, text, now);
                session.Messages.Add(message);
                session.MessagesByClientId.Add(dedupeKey, message);
                session.LastMessageAt[gamePlayerId] = now;
                session.LastTouchedAt = now;
                return new GameRoomSessionResult(GameRoomSessionResultStatus.Success, CreatePresentation(session), message);
            }
        }
    }

    public GameRoomSessionResult TrySetColor(
        Guid roomId,
        IReadOnlyCollection<GameRoomSessionPlayer> players,
        Guid gamePlayerId,
        string color,
        string roomStatus,
        DateTime? completedAt = null)
    {
        while (true)
        {
            var session = GetSession(roomId, players, roomStatus, completedAt);
            if (session is null)
                return new GameRoomSessionResult(IsAtCapacity
                    ? GameRoomSessionResultStatus.CapacityReached
                    : GameRoomSessionResultStatus.Expired);

            lock (session.Gate)
            {
                if (!IsCurrentSession(roomId, session))
                    continue;

                if (session.CompletedAt.HasValue || roomStatus != "WAITING")
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Conflict);

                EnsurePlayerColors(session, players);
                var chosenColor = color.Trim().ToLowerInvariant();
                if (!ColorCodes.Contains(chosenColor, StringComparer.Ordinal)
                    || !session.Colors.ContainsKey(gamePlayerId))
                {
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Conflict);
                }

                if (session.Colors.Any(pair => pair.Key != gamePlayerId && pair.Value == chosenColor))
                    return new GameRoomSessionResult(GameRoomSessionResultStatus.Conflict);

                session.Colors[gamePlayerId] = chosenColor;
                session.LastTouchedAt = _timeProvider.GetUtcNow();
                return new GameRoomSessionResult(GameRoomSessionResultStatus.Success, CreatePresentation(session));
            }
        }
    }

    public bool TouchConnection(
        Guid roomId,
        IReadOnlyCollection<GameRoomSessionPlayer> players,
        Guid gamePlayerId,
        Guid connectionId,
        string roomStatus)
    {
        if (connectionId == Guid.Empty || roomStatus is not ("WAITING" or "PLAYING"))
            return false;

        var session = GetSession(roomId, players, roomStatus, completedAt: null);
        if (session is null)
            return false;

        while (true)
        {
            lock (session.Gate)
            {
                if (!IsCurrentSession(roomId, session))
                    return false;
                if (!session.Colors.ContainsKey(gamePlayerId))
                    return false;

                var now = _timeProvider.GetUtcNow();
                session.Connections[(gamePlayerId, connectionId)] = now.Add(ConnectionLeaseLifetime);
                session.HasObservedConnections = true;
                session.LastTouchedAt = now;
                return true;
            }
        }
    }

    public bool DisconnectConnection(Guid roomId, Guid gamePlayerId, Guid connectionId)
    {
        if (!_cache.TryGetValue(roomId, out RoomSession? session) || session is null)
            return false;

        lock (session.Gate)
        {
            if (!IsCurrentSession(roomId, session)
                || !session.Connections.Remove((gamePlayerId, connectionId)))
            {
                return false;
            }

            ClearChatIfAllDisconnected(session, _timeProvider.GetUtcNow());
            return true;
        }
    }

    public void SweepExpiredConnections()
    {
        var now = _timeProvider.GetUtcNow();
        lock (_roomsGate)
        {
            PruneExpiredRoomKeys();
            foreach (var (roomId, session) in _trackedRooms.ToArray())
            {
                lock (session.Gate)
                {
                    if (!IsCurrentSession(roomId, session))
                        continue;

                    foreach (var key in session.Connections
                                 .Where(pair => pair.Value <= now)
                                 .Select(pair => pair.Key)
                                 .ToArray())
                    {
                        session.Connections.Remove(key);
                    }

                    ClearChatIfAllDisconnected(session, now);
                }
            }
        }
    }

    public void Dispose()
    {
        _connectionSweepTimer.Dispose();
        _cache.Dispose();
    }

    private RoomSession? GetSession(
        Guid roomId,
        IReadOnlyCollection<GameRoomSessionPlayer> players,
        string roomStatus,
        DateTime? completedAt)
    {
        var isCompleted = roomStatus == "COMPLETED";
        var now = _timeProvider.GetUtcNow();
        DateTimeOffset? completionExpiry = isCompleted && completedAt.HasValue
            ? AsUtcOffset(completedAt.Value).Add(_completedReadLifetime)
            : null;
        if (completionExpiry.HasValue && completionExpiry.Value <= now)
            return null;

        lock (_roomsGate)
        {
            if (_cache.TryGetValue(roomId, out RoomSession? cached) && cached is not null)
            {
                lock (cached.Gate)
                {
                    if (isCompleted)
                    {
                        cached.CompletedAt ??= completedAt.HasValue ? AsUtcOffset(completedAt.Value) : now;
                        cached.CompletionExpiresAt ??= cached.CompletedAt.Value.Add(_completedReadLifetime);
                        if (cached.CompletionExpiresAt <= now)
                        {
                            _cache.Remove(roomId);
                            _trackedRooms.Remove(roomId);
                            return null;
                        }

                        _cache.Set(roomId, cached, CreateEntryOptions(cached.CreationExpiresAt, cached.CompletionExpiresAt));
                    }
                    else if (cached.CompletedAt.HasValue)
                    {
                        return null;
                    }
                    cached.LastTouchedAt = now;
                }

                return cached;
            }

            PruneExpiredRoomKeys();
            if (_trackedRooms.Count >= _roomCapacity)
                return null;

            var session = new RoomSession(now, now.Add(_activeAbsoluteLifetime));
            if (isCompleted)
            {
                session.CompletedAt = completedAt.HasValue ? AsUtcOffset(completedAt.Value) : now;
                session.CompletionExpiresAt = session.CompletedAt.Value.Add(_completedReadLifetime);
                if (session.CompletionExpiresAt <= now)
                    return null;
            }

            EnsurePlayerColors(session, players);
            _cache.Set(roomId, session, CreateEntryOptions(session.CreationExpiresAt, session.CompletionExpiresAt));
            _trackedRooms[roomId] = session;
            return session;
        }
    }

    private MemoryCacheEntryOptions CreateEntryOptions(DateTimeOffset activeExpiry, DateTimeOffset? completionExpiry) =>
        new MemoryCacheEntryOptions
        {
            Size = 1,
            SlidingExpiration = _idleLifetime,
            AbsoluteExpiration = completionExpiry ?? activeExpiry
        };

    private void EnsurePlayerColors(RoomSession session, IReadOnlyCollection<GameRoomSessionPlayer> players)
    {
        var ordered = players.OrderBy(player => player.SeatNo).ThenBy(player => player.GamePlayerId).ToArray();
        var used = session.Colors.Values.ToHashSet(StringComparer.Ordinal);
        foreach (var player in ordered)
        {
            if (session.Colors.ContainsKey(player.GamePlayerId))
                continue;

            var preferredIndex = Math.Clamp(player.SeatNo - 1, 0, ColorCodes.Length - 1);
            var color = ColorCodes.Skip(preferredIndex).Concat(ColorCodes.Take(preferredIndex))
                .FirstOrDefault(candidate => !used.Contains(candidate));
            if (color is null)
                continue;

            session.Colors.Add(player.GamePlayerId, color);
            used.Add(color);
        }
    }

    private bool IsCurrentSession(Guid roomId, RoomSession session) =>
        _cache.TryGetValue(roomId, out RoomSession? current) && ReferenceEquals(current, session);

    private void PruneExpiredRoomKeys()
    {
        var now = _timeProvider.GetUtcNow();
        foreach (var (roomId, session) in _trackedRooms.ToArray())
        {
            lock (session.Gate)
            {
                if (EffectiveExpiry(session) > now)
                    continue;

                _cache.Remove(roomId);
                _trackedRooms.Remove(roomId);
            }
        }
    }

    private DateTimeOffset EffectiveExpiry(RoomSession session) =>
        session.LastTouchedAt.Add(_idleLifetime) is var idleExpiry
            ? session.CompletionExpiresAt.HasValue
                ? (idleExpiry < session.CompletionExpiresAt.Value ? idleExpiry : session.CompletionExpiresAt.Value)
                : (idleExpiry < session.CreationExpiresAt ? idleExpiry : session.CreationExpiresAt)
            : session.CreationExpiresAt;

    private static void ClearChatIfAllDisconnected(RoomSession session, DateTimeOffset now)
    {
        if (!session.HasObservedConnections || session.Connections.Values.Any(expiry => expiry > now))
            return;

        session.Messages.Clear();
        session.MessagesByClientId.Clear();
        session.LastMessageAt.Clear();
        session.HasObservedConnections = false;
    }

    private static GameRoomPresentation CreatePresentation(RoomSession session) =>
        new(
            session.Colors.ToDictionary(pair => pair.Key.ToString(), pair => pair.Value, StringComparer.Ordinal),
            session.Messages.ToArray());

    private static DateTimeOffset AsUtcOffset(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private sealed class RoomSession(DateTimeOffset createdAt, DateTimeOffset creationExpiresAt)
    {
        public object Gate { get; } = new();
        public DateTimeOffset LastTouchedAt { get; set; } = createdAt;
        public DateTimeOffset CreationExpiresAt { get; } = creationExpiresAt;
        public DateTimeOffset? CompletedAt { get; set; }
        public DateTimeOffset? CompletionExpiresAt { get; set; }
        public bool HasObservedConnections { get; set; }
        public Dictionary<Guid, string> Colors { get; } = [];
        public List<GameRoomSessionMessage> Messages { get; } = [];
        public Dictionary<(Guid PlayerId, Guid ClientMessageId), GameRoomSessionMessage> MessagesByClientId { get; } = [];
        public Dictionary<Guid, DateTimeOffset> LastMessageAt { get; } = [];
        public Dictionary<(Guid PlayerId, Guid ConnectionId), DateTimeOffset> Connections { get; } = [];
    }

    private sealed class TimeProviderSystemClock(TimeProvider timeProvider) : ISystemClock
    {
#pragma warning disable CS0618
        public DateTimeOffset UtcNow => timeProvider.GetUtcNow();
#pragma warning restore CS0618
    }
}
