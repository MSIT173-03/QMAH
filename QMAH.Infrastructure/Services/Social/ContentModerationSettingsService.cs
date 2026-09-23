using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

using QMAH.Infrastructure.Data;

namespace QMAH.Infrastructure.Services.Social;

public sealed record ContentModerationSettingsSnapshot(int SimHashWindowDays, int SimHashHammingThreshold);

/// <summary>
/// SimHash 重複偵測要比對的天數／Hamming 差幾 bit 以內算太像，這兩個值原本是
/// <see cref="ContentSimilarityService"/> 裡的常數，現在改成後台可調整的單一設定列
/// （<c>social.ContentModerationSettings</c>）。跟 <see cref="KeywordFilterService"/> 的關鍵字自動機一樣，
/// 用 Singleton 快取目前生效值，避免每篇貼文/留言都查一次資料庫；後台改設定後呼叫 <see cref="ReloadAsync"/> 更新。
/// </summary>
public sealed class ContentModerationSettingsService(IServiceScopeFactory scopeFactory)
{
    public const byte SettingsRowId = 1;

    // 資料庫裡還沒有設定列時（例如升級腳本還沒跑）的退回值，跟原本寫死的常數一致。
    public const int DefaultSimHashWindowDays = 7;
    public const int DefaultSimHashHammingThreshold = 8;

    private volatile ContentModerationSettingsSnapshot? _cache;
    private readonly SemaphoreSlim _reloadLock = new(1, 1);

    public async Task<ContentModerationSettingsSnapshot> GetAsync(CancellationToken cancellationToken = default) =>
        _cache ?? await ReloadAsync(cancellationToken);

    /// <summary>後台更新設定後呼叫，重新從資料庫載入目前生效值。</summary>
    public async Task<ContentModerationSettingsSnapshot> ReloadAsync(CancellationToken cancellationToken = default)
    {
        await _reloadLock.WaitAsync(cancellationToken);
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
            var entity = await db.ContentModerationSettings
                .AsNoTracking()
                .SingleOrDefaultAsync(setting => setting.Id == SettingsRowId, cancellationToken);

            var snapshot = entity is null
                ? new ContentModerationSettingsSnapshot(DefaultSimHashWindowDays, DefaultSimHashHammingThreshold)
                : new ContentModerationSettingsSnapshot(entity.SimHashWindowDays, entity.SimHashHammingThreshold);
            _cache = snapshot;
            return snapshot;
        }
        finally
        {
            _reloadLock.Release();
        }
    }
}
