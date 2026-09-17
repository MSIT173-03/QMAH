using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;

namespace QMAH.Api.Controllers.V1;

/// <summary>提供目前會員的圖鑑解鎖狀態與解鎖歷史。</summary>
[Authorize]
[Route("api/v1/me/catalog")]
public sealed class MemberCatalogController(
    QmahDbContext db,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    /// <summary>取得目前會員圖鑑清單，包含每件文物的解鎖狀態。</summary>
    [HttpGet("artifacts")]
    public async Task<ActionResult<ApiPage<MemberArtifactListItemDto>>> GetArtifacts(
        string? q,
        string? categoryCode,
        string? eraCode,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        q = q?.Trim();
        categoryCode = NormalizeCode(categoryCode);
        eraCode = NormalizeCode(eraCode);

        var query = db.Artifacts
            .AsNoTracking()
            .Where(artifact => artifact.IsActive);

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(artifact =>
                artifact.Name.Contains(q)
                || artifact.ArtifactRef.Contains(q)
                || (artifact.EraTextOriginal != null && artifact.EraTextOriginal.Contains(q)));
        }

        if (!string.IsNullOrWhiteSpace(categoryCode))
            query = query.Where(artifact => artifact.Category.Code == categoryCode);
        if (!string.IsNullOrWhiteSpace(eraCode))
            query = query.Where(artifact => artifact.EraBucket.Code == eraCode);

        var projected = query
            .OrderBy(artifact => artifact.Name)
            .ThenBy(artifact => artifact.Id)
            .Select(artifact => new MemberArtifactListItemDto(
                artifact.Id,
                artifact.ArtifactRef,
                artifact.Name,
                artifact.CategoryId,
                artifact.Category.Code,
                artifact.Category.Name,
                artifact.EraBucketId,
                artifact.EraBucket.Code,
                artifact.EraBucket.Name,
                artifact.ThumbnailPath ?? artifact.PrimaryImagePath,
                artifact.ArtifactQuestionEntry != null,
                artifact.Product != null,
                artifact.ArtifactUnlocks.Any(unlock => unlock.UserId == userId),
                artifact.ArtifactUnlocks
                    .Where(unlock => unlock.UserId == userId)
                    .Select(unlock => (DateTime?)unlock.UnlockedAt)
                    .FirstOrDefault()));

        var result = await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken);
        return Ok(result with
        {
            Items = result.Items
                .Select(item => item with
                {
                    ThumbnailPath = mediaUrlResolver.Resolve(item.ThumbnailPath)
                })
                .ToList()
        });
    }

    /// <summary>取得目前會員的文物解鎖歷史，最新解鎖排在前面。</summary>
    [HttpGet("unlocks")]
    public async Task<ActionResult<ApiPage<MemberArtifactUnlockDto>>> GetUnlocks(
        string? q,
        string? categoryCode,
        string? eraCode,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();

        q = q?.Trim();
        categoryCode = NormalizeCode(categoryCode);
        eraCode = NormalizeCode(eraCode);

        var query = db.ArtifactUnlocks
            .AsNoTracking()
            .Where(unlock => unlock.UserId == userId);

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(unlock =>
                unlock.Artifact.Name.Contains(q)
                || unlock.Artifact.ArtifactRef.Contains(q)
                || (unlock.Artifact.EraTextOriginal != null && unlock.Artifact.EraTextOriginal.Contains(q)));
        }

        if (!string.IsNullOrWhiteSpace(categoryCode))
            query = query.Where(unlock => unlock.Artifact.Category.Code == categoryCode);
        if (!string.IsNullOrWhiteSpace(eraCode))
            query = query.Where(unlock => unlock.Artifact.EraBucket.Code == eraCode);

        var projected = query
            .OrderByDescending(unlock => unlock.UnlockedAt)
            .ThenBy(unlock => unlock.Id)
            .Select(unlock => new MemberArtifactUnlockDto(
                unlock.Id,
                unlock.ArtifactId,
                unlock.Artifact.ArtifactRef,
                unlock.Artifact.Name,
                unlock.Artifact.Category.Code,
                unlock.Artifact.Category.Name,
                unlock.Artifact.EraBucket.Code,
                unlock.Artifact.EraBucket.Name,
                unlock.UnlockMethod,
                unlock.GameRoundId,
                unlock.KeyTransactionId,
                unlock.UnlockedAt));

        return Ok(await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken));
    }

    private static string NormalizeCode(string? value) => value?.Trim().ToUpperInvariant() ?? "";
}
