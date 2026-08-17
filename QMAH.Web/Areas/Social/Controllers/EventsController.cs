using System;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    [AdminNavigation("活動", 20)]
    public class EventsController : Controller
    {
        private readonly QmahDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public EventsController(QmahDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        // GET: Social/Events (僅顯示已通過且已發布的活動)
        public async Task<IActionResult> Index()
        {
            var events = await _context.Events
                .Where(e => e.ReviewStatus == "APPROVED" && e.PublishStatus == "PUBLISHED")
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            return View(events);
        }

        // GET: Social/Events/Create
        [Authorize]
        public IActionResult Create()
        {
            return View();
        }

        // POST: Social/Events/Create (玩家發起活動，預設待審核)
        [HttpPost]
        [Authorize]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Event model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            Guid currentUserId = _currentUserService.GetCurrentUserId();

            model.Id = Guid.NewGuid();
            model.OrganizerUserId = currentUserId;
            model.ReviewStatus = "PENDING";  // 預設待審核
            model.PublishStatus = "DRAFT";   // 預設草稿 (未公開)
            model.CreatedAt = DateTime.UtcNow;

            _context.Events.Add(model);
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "活動提案已送出，等待管理員審核中！";
            return RedirectToAction(nameof(Index));
        }
    }
}
