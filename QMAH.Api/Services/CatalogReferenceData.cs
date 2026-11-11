using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using QMAH.Api.Controllers.V1;
using QMAH.Infrastructure.Data;

namespace QMAH.Api.Services;

/// <summary>Short-lived, public reference data only. Never cache member state here.</summary>
public sealed class CatalogReferenceData(IServiceScopeFactory scopes, IMemoryCache cache) : IDisposable
{
    private readonly SemaphoreSlim reload = new(1, 1);
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);

    public Task<IReadOnlyList<CodeLabelDto>> CategoriesAsync(CancellationToken cancellationToken = default) =>
        GetAsync("catalog-reference:categories", db => db.ArtifactCategories.AsNoTracking()
            .OrderBy(category => category.Name)
            .Select(category => new CodeLabelDto(category.Id, category.Code, category.Name)), cancellationToken);

    public Task<IReadOnlyList<CodeLabelDto>> ErasAsync(bool chronological, CancellationToken cancellationToken = default) =>
        GetAsync(chronological ? "catalog-reference:eras:chronological" : "catalog-reference:eras:code", db =>
        {
            var query = db.EraBuckets.AsNoTracking();
            var ordered = chronological ? query.OrderBy(era => era.StartYear).ThenBy(era => era.Name) : query.OrderBy(era => era.Code);
            return ordered.Select(era => new CodeLabelDto(era.Id, era.Code, era.Name));
        }, cancellationToken);

    private async Task<IReadOnlyList<CodeLabelDto>> GetAsync(string key,
        Func<QmahDbContext, IQueryable<CodeLabelDto>> query, CancellationToken cancellationToken)
    {
        if (cache.TryGetValue<IReadOnlyList<CodeLabelDto>>(key, out var cached)) return cached!;
        await reload.WaitAsync(cancellationToken);
        try
        {
            // A cold burst must share one database read, not one per request.
            if (cache.TryGetValue<IReadOnlyList<CodeLabelDto>>(key, out cached)) return cached!;
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<QmahDbContext>();
            IReadOnlyList<CodeLabelDto> result = await query(db).ToArrayAsync(cancellationToken);
            cache.Set(key, result, Lifetime);
            return result;
        }
        finally { reload.Release(); }
    }

    public void Dispose() => reload.Dispose();
}
