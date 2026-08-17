using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    //[Authorize(Policy = "Policy.Social.ManageReports")]
    public class SocialPostAdminController : Controller
    {
        private readonly QmahDbContext _context;

        public SocialPostAdminController(QmahDbContext context)
        {
            _context = context;
        }

        // GET: /Social/SocialPostAdmin/Posts
        public async Task<IActionResult> Posts(string? status)
        {
            var query = _context.SocialPosts.AsNoTracking();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(p => p.Status == status);

            var list = await query
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new AdminPostListViewModel
                {
                    Id = p.Id,
                    Title = p.Title,
                    BoardCode = p.BoardCode ?? "GENERAL",
                    Status = p.Status,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return View("~/Areas/Social/Views/SocialAdmin/SocialPostAdmin.cshtml", list);
        }

        // POST: /Social/SocialPostAdmin/TogglePostStatus
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> TogglePostStatus(Guid id, string status)
        {
            var post = await _context.SocialPosts.FindAsync(id);
            if (post != null)
            {
                try
                {
                    post.Status = status; // e.g. "HIDDEN", "PUBLISHED"
                    await _context.SaveChangesAsync();
                    TempData["SuccessMessage"] = $"貼文狀態已成功更新為：{status}";
                }
                catch (DbUpdateException ex)
                {
                    var innerMsg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                    TempData["ErrorMessage"] = $"更新狀態失敗，資料庫限制或異常：{innerMsg}";
                }
            }
            return RedirectToAction(nameof(Posts));
        }
    }
}