using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
public class MembersController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly QmahDbContext _context;

    public MembersController(
        UserManager<ApplicationUser> userManager,
        QmahDbContext context)
    {
        _userManager = userManager;
        _context = context;
    }

    public async Task<IActionResult> Index(
    string? keyword,
    string? role,
    string? status,
    int page = 1)
    {
        int pageSize = 5;

        // 先查帳號
        var query = _userManager.Users.AsQueryable();

        // 關鍵字搜尋
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            keyword = keyword.Trim();

            query = query.Where(x =>
                (x.Email != null && x.Email.Contains(keyword)) ||
                (x.UserName != null && x.UserName.Contains(keyword))
            );
        }

        // 狀態篩選
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        var users = query
            .OrderBy(x => x.Email)
            .ToList();

        // 先組合 User + Role + Point
        var allMembers = new List<MemberListItemViewModel>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var userRole = roles.FirstOrDefault() ?? "Member";

            // 角色篩選
            if (!string.IsNullOrWhiteSpace(role) &&
                userRole != role)
            {
                continue;
            }

            var pointBalance = _context.PointBalances
                .AsNoTracking()
                .SingleOrDefault(x => x.UserId == user.Id);

            var profile = _context.UserProfiles
                .AsNoTracking()
                .SingleOrDefault(x => x.UserId == user.Id);

            allMembers.Add(new MemberListItemViewModel
            {
                User = user,
                Role = userRole,
                PointBalance = pointBalance?.Balance ?? 0,
                Nickname = profile?.Nickname
            });
        }

        // 角色也篩完之後，才算總筆數
        int totalCount = allMembers.Count;

        int totalPages = (int)Math.Ceiling(
            totalCount / (double)pageSize
        );

        // 避免 page 小於 1
        if (page < 1)
        {
            page = 1;
        }

        // 避免超過最後一頁
        if (totalPages > 0 && page > totalPages)
        {
            page = totalPages;
        }

        // 最後才分頁
        var members = allMembers
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // 保留搜尋條件
        ViewBag.Keyword = keyword;
        ViewBag.Role = role;
        ViewBag.Status = status;

        // 分頁資料
        ViewBag.CurrentPage = page;
        ViewBag.PageSize = pageSize;
        ViewBag.TotalCount = totalCount;
        ViewBag.TotalPages = totalPages;

        // 上方統計卡
        var allUsers = _userManager.Users;

        ViewBag.TotalMembers = allUsers.Count();

        var now = DateTime.UtcNow;
        var thirtyDaysAgo = now.AddDays(-30);

        ViewBag.NewMembers = allUsers
            .Count(x => x.CreatedAt >= thirtyDaysAgo);

        ViewBag.BannedMembers = allUsers
            .Count(x => x.Status == "BANNED");

        return View(members);
    }

    public IActionResult Details(Guid id)
    {
        var user = _userManager.Users
            .SingleOrDefault(x => x.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var profile = _context.UserProfiles
            .SingleOrDefault(x => x.UserId == id);

        var addresses = _context.UserAddresses
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.IsDefault)
            .ToList();

        var pointTransactions = _context.PointTransactions
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        var viewModel = new MemberDetailsViewModel
        {
            User = user,
            Profile = profile,
            Addresses = addresses,
            PointTransactions = pointTransactions
        };

        return View(viewModel);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangeStatus(Guid id)
    {
        var member = await _userManager.FindByIdAsync(id.ToString());
        if (member == null)
        {
            return NotFound();
        }
        // ACTIVE → BANNED
        // BANNED → ACTIVE
        if (member.Status == "ACTIVE")
        {
            member.Status = "BANNED";
        }
        else if (member.Status == "BANNED")
        {
            member.Status = "ACTIVE";
        }
        member.UpdatedAt = DateTime.UtcNow;
        var result = await _userManager.UpdateAsync(member);
        if (!result.Succeeded)
        {
            return BadRequest("會員狀態更新失敗");
        }
        return RedirectToAction(nameof(Index));
    }


    public IActionResult Edit(Guid id)
    {
        var user = _userManager.Users
            .SingleOrDefault(x => x.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var profile = _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefault(x => x.UserId == id);

        if (profile == null)
        {
            return NotFound();
        }

        var model = new MemberEditViewModel
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            Nickname = profile.Nickname,
            Bio = profile.Bio,
            AvatarPath = profile.AvatarPath,
            Visibility = profile.Visibility
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Edit(Guid id, MemberEditViewModel model)
    {
        if (id != model.UserId)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var profile = _context.UserProfiles
            .SingleOrDefault(x => x.UserId == id);

        if (profile == null)
        {
            return NotFound();
        }

        profile.Nickname = model.Nickname.Trim();
        profile.Bio = model.Bio?.Trim();
        profile.AvatarPath = model.AvatarPath?.Trim();
        profile.Visibility = model.Visibility;
        profile.UpdatedAt = DateTime.UtcNow;

        _context.SaveChanges();

        return RedirectToAction(nameof(Details), new { id });
    }


    public IActionResult AdjustPoints(Guid id)
    {
        var user = _userManager.Users
            .AsNoTracking()
            .SingleOrDefault(x => x.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var pointBalance = _context.PointBalances
            .AsNoTracking()
            .SingleOrDefault(x => x.UserId == id);

        var model = new PointAdjustViewModel
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            CurrentBalance = pointBalance?.Balance ?? 0
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AdjustPoints(
    Guid id,
    PointAdjustViewModel model)
    {
        // 防止網址 id 跟表單 UserId 不一致
        if (id != model.UserId)
        {
            return BadRequest();
        }

        // 後端重新確認會員存在
        var user = await _userManager.FindByIdAsync(id.ToString());

        if (user == null)
        {
            return NotFound();
        }

        // 後端重新取得目前點數
        var pointBalance = await _context.PointBalances
            .SingleOrDefaultAsync(x => x.UserId == id);

        if (pointBalance == null)
        {
            return NotFound();
        }

        // 不允許輸入 0
        if (model.Amount == 0)
        {
            ModelState.AddModelError(
                nameof(model.Amount),
                "調整點數不能為 0。"
            );
        }

        // 不允許扣成負數
        if (pointBalance.Balance + model.Amount < 0)
        {
            ModelState.AddModelError(
                nameof(model.Amount),
                "會員點數不足，不能扣成負數。"
            );
        }

        // 原因不能空白
        if (string.IsNullOrWhiteSpace(model.Reason))
        {
            ModelState.AddModelError(
                nameof(model.Reason),
                "請輸入調整原因。"
            );
        }

        if (!ModelState.IsValid)
        {
            model.Email = user.Email ?? "";
            model.CurrentBalance = pointBalance.Balance;

            return View(model);
        }

        // 同時處理餘額 + 流水
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. 更新目前餘額
            pointBalance.Balance += model.Amount;
            pointBalance.UpdatedAt = DateTime.UtcNow;

            // 2. 新增一筆點數流水
            var pointTransaction = new PointTransaction
            {
                Id = Guid.NewGuid(),
                UserId = id,
                Amount = model.Amount,
                Reason = model.Reason.Trim(),
                ReferenceType = "ADMIN_ADJUSTMENT",
                ReferenceId = null,
                CreatedAt = DateTime.UtcNow
            };

            _context.PointTransactions.Add(pointTransaction);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return RedirectToAction(nameof(Details), new { id });
    }
}