using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

using System.Security.Claims;

namespace QMAH.API.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/reports")]
[Authorize(Roles = "Admin")]
public class AdminReportsController : ControllerBase
{
    private readonly QmahDbContext _dbContext;

    public AdminReportsController(QmahDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public class UpdateReportDto
    {
        public string Status { get; set; } = null!; // RESOLVED, DISMISSED
        public string? Resolution { get; set; }
        public string? ContentAction { get; set; } // HIDDEN, DELETED (針對違規內容)
    }

    // 取得檢舉列表
    [HttpGet]
    public async Task<IActionResult> GetReports([FromQuery] string? status = "PENDING")
    {
        var query = _dbContext.ContentReports
            .Include(r => r.ReporterUser)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(r => r.Status == status);

        var reports = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return Ok(reports);
    }

    // 審核檢舉並處理違規內容
    [HttpPut("{id}")]
    public async Task<IActionResult> ReviewReport(Guid id, [FromBody] UpdateReportDto dto)
    {
        var currentUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var report = await _dbContext.ContentReports.FirstOrDefaultAsync(r => r.Id == id);
        if (report == null)
            return NotFound(new { message = "找不到該檢舉單" });

        report.Status = dto.Status;
        report.Resolution = dto.Resolution;
        report.ReviewedByUserId = currentUserId;
        report.ReviewedAt = DateTime.UtcNow;

        // 若確認違規 (RESOLVED) 且有指定動作，處理對應內容
        if (dto.Status == "RESOLVED" && !string.IsNullOrEmpty(dto.ContentAction))
        {
            if (report.TargetType == "POST")
            {
                var post = await _dbContext.SocialPosts.FirstOrDefaultAsync(p => p.Id == report.TargetId);
                if (post != null) post.Status = dto.ContentAction; // e.g., HIDDEN or DELETED
            }
            else if (report.TargetType == "COMMENT")
            {
                var comment = await _dbContext.SocialComments.FirstOrDefaultAsync(c => c.Id == report.TargetId);
                if (comment != null) comment.Status = dto.ContentAction; // e.g., HIDDEN or DELETED
            }
        }

        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "檢舉處理完畢", report.Id, report.Status });
    }
}