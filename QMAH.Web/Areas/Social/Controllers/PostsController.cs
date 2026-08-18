using System;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Social.Controllers
{
    [Area("Social")]
    [AdminNavigation("貼文", 10)]
    public class PostsController : Controller
    {
        private readonly QmahDbContext _context;
        private readonly ICurrentUserService _currentUserService;

        public PostsController(QmahDbContext context, ICurrentUserService currentUserService)
        {
            _context = context;
            _currentUserService = currentUserService;
        }

        // GET: Social/Posts
        public async Task<IActionResult> Index()
        {
            var posts = await _context.SocialPosts
                .Where(p => p.Status == "PUBLISHED") // 👈 關鍵修改：僅抓取發布狀態為 PUBLISHED 的貼文（自動屏蔽 HIDDEN 與 DELETED）
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new PostListViewModel
                {
                    Id = p.Id,
                    BoardCode = p.BoardCode,
                    UserId = p.UserId,
                    UserName = _context.UserProfiles
                        .Where(u => u.UserId == p.UserId)
                        .Select(u => u.Nickname)
                        .FirstOrDefault() ?? "未知使用者",
                    ArtifactId = p.ArtifactId,
                    Title = p.Title,
                    Content = p.Content,
                    Status = p.Status,
                    CreatedAt = p.CreatedAt
                })
                .ToListAsync();

            return View(posts);
        }

        // GET: Social/Posts/Create
        public IActionResult Create()
        {
            return View(new PostCreateViewModel());
        }

        // POST: Social/Posts/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(PostCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            Guid currentUserId = _currentUserService.GetCurrentUserId();

            var newPost = new SocialPost
            {
                Id = Guid.NewGuid(),
                BoardCode = model.BoardCode ?? "GENERAL",
                UserId = currentUserId,
                ArtifactId = model.ArtifactId,
                Title = model.Title,
                Content = model.Content,
                Status = "PUBLISHED",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.SocialPosts.Add(newPost);
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "貼文發布成功！";
            return RedirectToAction(nameof(Index));
        }
    }
}
