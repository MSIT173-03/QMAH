using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

/// <summary>查詢啟用中的鑰匙規則；會員餘額另由經濟 API 提供。</summary>
[Authorize]
[Route("api/v1/catalog/key-definitions")]
public sealed class KeyDefinitionsController(QmahDbContext db) : ApiControllerBase
{
    /// <summary>取得啟用中的鑰匙定義，包含分類、年代與指定目標能力。</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KeyDefinitionDto>>> GetDefinitions(
        CancellationToken cancellationToken = default) =>
        Ok(await Definitions().OrderBy(key => key.Code).ToListAsync(cancellationToken));

    /// <summary>依實際鑰匙代碼取得定義；不存在或停用時回傳 404。</summary>
    [HttpGet("{keyCode}")]
    public async Task<ActionResult<KeyDefinitionDto>> GetDefinition(
        string keyCode, CancellationToken cancellationToken = default)
    {
        keyCode = keyCode.Trim().ToUpperInvariant();
        var definition = await Definitions().SingleOrDefaultAsync(
            key => key.Code == keyCode, cancellationToken);
        if (definition is null)
            return Problem(statusCode: 404, title: "找不到鑰匙定義", detail: "鑰匙不存在或已停用。");
        return Ok(definition);
    }

    private IQueryable<KeyDefinitionDto> Definitions() => db.KeyDefinitions
        .AsNoTracking()
        .Where(key => key.IsActive)
        .Select(key => new KeyDefinitionDto(
            key.Id, key.Code, key.Name, key.ScopeType,
            key.CategoryId,
            key.Category == null ? null : key.Category.Code,
            key.Category == null ? null : key.Category.Name,
            key.EraBucketId,
            key.EraBucket == null ? null : key.EraBucket.Code,
            key.EraBucket == null ? null : key.EraBucket.Name,
            key.RecyclePointValue,
            key.ScopeType == "CATEGORY" || key.ScopeType == "ERA" || key.ScopeType == "UNIVERSAL"));
}

/// <summary>啟用中的鑰匙定義，不含會員餘額；Code 用於既有解鎖 API。</summary>
public sealed record KeyDefinitionDto(
    Guid Id, string Code, string Name, string ScopeType,
    Guid? CategoryId, string? CategoryCode, string? CategoryName,
    Guid? EraBucketId, string? EraCode, string? EraName,
    int RecyclePointValue, bool CanSelectArtifact);
