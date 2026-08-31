using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;

namespace QMAH.Api.Controllers.V1;

[AllowAnonymous]
[Route("api/v1/metadata")]
public sealed class MetadataController(QmahDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiMetadataDto>> GetMetadata(CancellationToken cancellationToken = default)
    {
        var categories = await db.ArtifactCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .Select(category => new CodeLabelDto(category.Id, category.Code, category.Name))
            .ToListAsync(cancellationToken);
        var eras = await db.EraBuckets
            .AsNoTracking()
            .OrderBy(era => era.Code)
            .Select(era => new CodeLabelDto(era.Id, era.Code, era.Name))
            .ToListAsync(cancellationToken);

        return Ok(new ApiMetadataDto(
            categories,
            eras,
            [
                new("GENERAL", "綜合交流"),
                new("CATALOG", "文物討論"),
                new("DISCOVERY", "探索發現"),
                new("REVIEW", "鑑賞心得"),
                new("QUESTION", "問題求助"),
                new("GUIDE", "研究筆記"),
                new("EVENT", "活動")
            ],
            [
                new("POST", "一般貼文"),
                new("ANNOUNCEMENT", "公告貼文"),
                new("EVENT", "活動貼文")
            ],
            [
                new("COMMUNITY", "社群發布"),
                new("OFFICIAL", "官方發布")
            ],
            [
                new("PLAYER", "玩家活動"),
                new("OFFICIAL", "官方活動")
            ],
            [
                new("PENDING", "待審核"),
                new("APPROVED", "已核准"),
                new("REJECTED", "已駁回")
            ],
            [
                new("DRAFT", "草稿"),
                new("PUBLISHED", "已發布"),
                new("CANCELLED", "已取消")
            ],
            [
                new("ACTIVE", "可使用"),
                new("HIDDEN", "已隱藏"),
                new("DELETED", "已刪除")
            ]));
    }
}
