using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Data;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize]
public class ProfileController : Controller
{
    private readonly QmahDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public ProfileController(
        QmahDbContext context,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }


    public async Task<IActionResult> Index()
    {
        // 從目前登入狀態取得本人
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        // 只查目前登入者自己的 Profile
        var profile = await _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == user.Id);

        if (profile == null)
        {
            return NotFound();
        }

        return View(profile);
    }
}