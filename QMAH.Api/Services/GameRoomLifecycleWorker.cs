using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

using QMAH.Infrastructure.Services.Game;

namespace QMAH.Api.Services;

public sealed class GameRoomLifecycleWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<GameRoomLifecycleWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var gameLifecycle = scope.ServiceProvider.GetRequiredService<GameRoomLifecycleService>();
                await gameLifecycle.ProcessExpiredPresenceAsync(stoppingToken);
                await gameLifecycle.ProcessDueGamesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "推進多人遊戲房間狀態時發生錯誤。");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken))
                break;
        }
    }
}
