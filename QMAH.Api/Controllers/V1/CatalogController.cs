using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Media;

namespace QMAH.Api.Controllers.V1;

[Route("api/v1/catalog")]
public sealed class CatalogController(
    QmahDbContext db,
    QmahMediaUrlResolver mediaUrlResolver) : ApiControllerBase
{
    [HttpGet("artifacts")]
    public async Task<ActionResult<ApiPage<ArtifactListItemDto>>> GetArtifacts(
        string? q,
        string? categoryCode,
        string? eraCode,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = db.Artifacts
            .AsNoTracking()
            .Where(artifact => artifact.IsActive);
        q = q?.Trim();
        categoryCode = NormalizeCode(categoryCode);
        eraCode = NormalizeCode(eraCode);

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
            .Select(artifact => new ArtifactListItemDto(
                artifact.Id,
                artifact.ArtifactRef,
                artifact.Name,
                artifact.Category.Code,
                artifact.Category.Name,
                artifact.EraBucket.Code,
                artifact.EraBucket.Name,
                artifact.ThumbnailPath ?? artifact.PrimaryImagePath,
                artifact.ArtifactQuestionEntry != null,
                artifact.Product != null));

        var result = await ApiPaging.ToPageAsync(projected, page, pageSize, cancellationToken);
        // 原本直接回傳資料庫中的 ThumbnailPath；棄用原因：資料庫保存的是邏輯路徑，CDN 模式必須由共用解析器補上公開來源。
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

    [HttpGet("artifacts/{id:guid}")]
    public async Task<ActionResult<ArtifactDetailsDto>> GetArtifact(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var artifact = await db.Artifacts
            .AsNoTracking()
            .Where(item => item.Id == id && item.IsActive)
            .Select(item => new ArtifactDetailsDto(
                item.Id,
                item.ArtifactRef,
                item.Name,
                item.Category.Code,
                item.Category.Name,
                item.EraBucket.Code,
                item.EraBucket.Name,
                item.EraTextOriginal,
                item.CreatorDisplay,
                item.Description,
                item.SizeText,
                item.PrimaryImagePath,
                item.ThumbnailPath,
                item.SourceUrl,
                item.LicenseCode,
                item.AttributionText,
                item.ArtifactQuestionEntry != null,
                item.Product != null))
            .SingleOrDefaultAsync(cancellationToken);

        if (artifact is null)
            return MissingResource("找不到文物", "這筆文物不存在或目前未啟用。");

        // 原本直接回傳 PrimaryImagePath／ThumbnailPath；棄用原因：前台部署位置可能改為 CDN，不能把資料庫路徑當成完整公開網址。
        return Ok(artifact with
        {
            PrimaryImagePath = mediaUrlResolver.Resolve(artifact.PrimaryImagePath) ?? artifact.PrimaryImagePath,
            ThumbnailPath = mediaUrlResolver.Resolve(artifact.ThumbnailPath)
        });
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<CodeLabelDto>>> GetCategories(
        CancellationToken cancellationToken = default) =>
        Ok(await db.ArtifactCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .Select(category => new CodeLabelDto(category.Id, category.Code, category.Name))
            .ToListAsync(cancellationToken));

    [HttpGet("eras")]
    public async Task<ActionResult<IReadOnlyList<CodeLabelDto>>> GetEras(
        CancellationToken cancellationToken = default) =>
        Ok(await db.EraBuckets
            .AsNoTracking()
            .OrderBy(era => era.StartYear)
            .ThenBy(era => era.Name)
            .Select(era => new CodeLabelDto(era.Id, era.Code, era.Name))
            .ToListAsync(cancellationToken));

    private static string NormalizeCode(string? value) => value?.Trim().ToUpperInvariant() ?? "";
}
