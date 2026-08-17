using System;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AllowAnonymous]
public class SocialReportAdminController : Controller
{
    private readonly QmahDbContext _context;

    public SocialReportAdminController(QmahDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Reports()
    {
        var reports = await _context.ContentReports
            .Where(r => r.Status == "PENDING")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReportListViewModel
            {
                Id = r.Id,
                TargetType = r.TargetType,
                TargetId = r.TargetId,
                TargetTitle = r.TargetType == "POST"
                    ? (_context.SocialPosts.Where(p => p.Id == r.TargetId).Select(p => p.Title).FirstOrDefault() ?? "無標題")
                    : "留言檢舉",
                TargetContent = r.TargetType == "POST"
                    ? (_context.SocialPosts.Where(p => p.Id == r.TargetId).Select(p => p.Content).FirstOrDefault() ?? "內容已不存在")
                    : (_context.SocialComments.Where(c => c.Id == r.TargetId).Select(c => c.Content).FirstOrDefault() ?? "內容已不存在"),
                Reason = r.Reason,
                Detail = r.Detail, // 檢舉人填寫的詳細理由
                Status = r.Status,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return View("~/Areas/Social/Views/SocialAdmin/SocialReportAdmin.cshtml", reports);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ReviewReport(Guid reportId, bool isApprove)
    {
        var report = await _context.ContentReports.FindAsync(reportId);
        if (report != null)
        {
            // 符合資料庫 CHECK 約束: RESOLVED 或 REJECTED
            report.Status = isApprove ? "RESOLVED" : "REJECTED";

            if (isApprove && report.TargetType == "POST")
            {
                var post = await _context.SocialPosts.FindAsync(report.TargetId);
                if (post != null)
                {
                    post.Status = "HIDDEN";
                }
            }

            try
            {
                await _context.SaveChangesAsync();
                TempData["SuccessMessage"] = isApprove ? "檢舉已核准並下架內容" : "已駁回該檢舉";
            }
            catch (DbUpdateException ex)
            {
                var innerException = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                TempData["ErrorMessage"] = $"儲存失敗：{innerException}";
            }
        }

        return RedirectToAction(nameof(Reports));
    }
}