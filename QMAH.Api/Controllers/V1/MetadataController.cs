using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QMAH.Api.Services;

namespace QMAH.Api.Controllers.V1;

[AllowAnonymous]
[Route("api/v1/metadata")]
public sealed class MetadataController(CatalogReferenceData referenceData) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiMetadataDto>> GetMetadata(CancellationToken cancellationToken = default)
    {
        var categories = await referenceData.CategoriesAsync(cancellationToken);
        var eras = await referenceData.ErasAsync(chronological: false, cancellationToken);

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
