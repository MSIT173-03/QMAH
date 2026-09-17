using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Api.Controllers.V1;

/// <summary>查詢目前會員使用指定鑰匙時的候選文物。</summary>
[Authorize]
[Route("api/v1/me/keys")]
public sealed class KeyCandidatesController(
    QmahDbContext db, EconomyService economyService,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    /// <summary>依鑰匙範圍取得啟用且尚未解鎖的文物分頁；不扣鑰匙。</summary>
    [HttpGet("{keyCode}/artifacts")]
    public async Task<ActionResult<ApiPage<ArtifactListItemDto>>> GetArtifacts(
        string keyCode, string? q = null, int page = 1, int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetCurrentUserId(out var userId))
            return Unauthorized();
        keyCode = keyCode.Trim().ToUpperInvariant();
        var key = await db.KeyDefinitions.AsNoTracking().SingleOrDefaultAsync(
            item => item.Code == keyCode && item.IsActive, cancellationToken);
        if (key is null)
            return Problem(statusCode: 404, title: "找不到鑰匙定義", detail: "鑰匙不存在或已停用。");

        var query = economyService.GetEligibleArtifactQuery(userId, key).AsNoTracking();
        q = q?.Trim();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(artifact => artifact.Name.Contains(q) || artifact.ArtifactRef.Contains(q));
        var result = await ApiPaging.ToPageAsync(query
            .OrderBy(artifact => artifact.Name).ThenBy(artifact => artifact.Id)
            .Select(artifact => new ArtifactListItemDto(
                artifact.Id, artifact.ArtifactRef, artifact.Name,
                artifact.Category.Code, artifact.Category.Name,
                artifact.EraBucket.Code, artifact.EraBucket.Name,
                artifact.ThumbnailPath ?? artifact.PrimaryImagePath,
                artifact.ArtifactQuestionEntry != null, artifact.Product != null)),
            page, pageSize, cancellationToken);
        return Ok(result with
        {
            Items = result.Items.Select(item => item with
            {
                ThumbnailPath = mediaUrlResolver.Resolve(item.ThumbnailPath)
            }).ToList()
        });
    }
}
