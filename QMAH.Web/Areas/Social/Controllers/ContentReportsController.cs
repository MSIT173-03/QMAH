using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;
using QMAH.Web.Areas.Social.Models;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AllowAnonymous] // 👈 暫時改為 AllowAnonymous 排查權限驗證問題
[Route("Social/[controller]/[action]")] // 👈 加上此屬性路由，明確指定 API 網址為 /Social/ContentReports/Create
public class ContentReportsController : Controller
{
    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ContentReportsController(QmahDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpPost]
    [IgnoreAntiforgeryToken] // 先忽略 Token 驗證，排查 404/400 瓶頸
    public async Task<IActionResult> Create([FromBody] ReportCreateInputModel model)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { success = false, message = "填寫資料格式不正確" });
        }

        Guid currentUserId = _currentUserService.GetCurrentUserId();

        var report = new ContentReport
        {
            Id = Guid.NewGuid(),
            ReporterUserId = currentUserId,
            TargetType = model.TargetType, // "POST" 或 "COMMENT"
            TargetId = model.TargetId,
            Reason = model.Reason,
            Detail = model.Detail,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _context.ContentReports.Add(report);
        await _context.SaveChangesAsync();

        return Json(new { success = true, message = "檢舉已成功送出！管理員將儘速審核。" });
    }
}