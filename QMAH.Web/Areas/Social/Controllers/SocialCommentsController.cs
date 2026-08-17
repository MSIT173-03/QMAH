using System;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Social.Models;
using QMAH.Web.Areas.Social.Services;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Social.Controllers;

[Area("Social")]
[AllowAnonymous]
[Route("Social/[controller]/[action]")]
public class SocialCommentsController : Controller
{
    private readonly QmahDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public SocialCommentsController(QmahDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<IActionResult> GetByPostId(Guid postId)
    {
        var comments = await _context.SocialComments
            .AsNoTracking()
            .Where(comment => comment.PostId == postId && comment.Status == "PUBLISHED")
            .OrderBy(comment => comment.CreatedAt)
            .Select(comment => new
            {
                userName = _context.UserProfiles
                    .Where(profile => profile.UserId == comment.UserId)
                    .Select(profile => profile.Nickname)
                    .FirstOrDefault() ?? "匿名",
                content = comment.Content,
                createdAt = comment.CreatedAt
            })
            .ToListAsync();

        return Json(comments);
    }

    [HttpPost]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Create([FromBody] SocialCommentCreateModel model)
    {
        if (!ModelState.IsValid || string.IsNullOrWhiteSpace(model.Content))
        {
            return BadRequest(new { success = false, message = "留言內容格式不正確" });
        }

        var postExists = await _context.SocialPosts
            .AnyAsync(post => post.Id == model.PostId && post.Status == "PUBLISHED");

        if (!postExists)
        {
            return NotFound(new { success = false, message = "找不到可留言的貼文" });
        }

        var now = DateTime.UtcNow;
        _context.SocialComments.Add(new SocialComment
        {
            Id = Guid.NewGuid(),
            PostId = model.PostId,
            UserId = _currentUserService.GetCurrentUserId(),
            Content = model.Content.Trim(),
            Status = "PUBLISHED",
            CreatedAt = now,
            UpdatedAt = now
        });

        await _context.SaveChangesAsync();
        return Json(new { success = true, message = "留言已送出" });
    }
}
