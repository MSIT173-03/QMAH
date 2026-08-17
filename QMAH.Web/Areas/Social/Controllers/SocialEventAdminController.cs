using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    //[Authorize(Policy = "Policy.Social.ManageEvents")]
    public class SocialEventAdminController : Controller
    {
        private readonly QmahDbContext _context;

        public SocialEventAdminController(QmahDbContext context)
        {
            _context = context;
        }

        // GET: /Social/SocialEventAdmin/Events
        public async Task<IActionResult> Events()
        {
            var list = await _context.Events
                .AsNoTracking()
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => new EventListViewModel
                {
                    Id = e.Id,
                    Title = e.Title,
                    Description = e.Content ?? string.Empty, // 1. 對應資料庫欄位 Content
                    Status = e.ReviewStatus,                  // 2. 對應資料庫欄位 ReviewStatus
                    CreatedAt = e.CreatedAt
                })
                .ToListAsync();

            return View("~/Areas/Social/Views/SocialAdmin/SocialEventAdmin.cshtml", list);
        }

        // POST: /Social/SocialEventAdmin/ReviewEvent
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ReviewEvent(Guid id, string status)
        {
            var evt = await _context.Events.FindAsync(id);
            if (evt != null)
            {
                // 1. 更新審核狀態 (APPROVED / REJECTED)
                evt.ReviewStatus = status;

                // 2. 記錄審核者與審核時間
                var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (Guid.TryParse(currentUserIdStr, out var currentUserId))
                {
                    evt.ReviewedByUserId = currentUserId;
                }
                evt.ReviewedAt = DateTime.UtcNow;

                // 3. 若審核通過，可自動將發布狀態設為已發布 (PUBLISHED)
                if (status == "APPROVED")
                {
                    evt.PublishStatus = "PUBLISHED";
                }

                await _context.SaveChangesAsync();
                TempData["SuccessMessage"] = $"活動審核完成，狀態已變更為：{status}";
            }

            return RedirectToAction(nameof(Events));
        }
    }
}