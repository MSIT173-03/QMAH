using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization; //登入權限
using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;
using QMAH.Web.Models.Identity;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
public class MembersController : Controller
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly QmahDbContext _context;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;

    public MembersController(
        UserManager<ApplicationUser> userManager,
        QmahDbContext context,
        RoleManager<IdentityRole<Guid>> roleManager)
    {
        _userManager = userManager;
        _context = context;
        _roleManager = roleManager;
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

        var pointBalance = _context.PointBalances
            .AsNoTracking()
            .SingleOrDefault(x => x.UserId == id);

        var pointTransactions = _context.PointTransactions
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToList();

        var achievements = _context.UserAchievements
            .AsNoTracking()
            .Include(x => x.Achievement)
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.AchievedAt)
            .ToList();

        var viewModel = new MemberDetailsViewModel
        {
            User = user,
            Profile = profile,
            Addresses = addresses,
            PointBalance = pointBalance?.Balance ?? 0,
            PointTransactions = pointTransactions,
            Achievements = achievements
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

        // 取得目前登入中的管理員
        var currentUser = await _userManager.GetUserAsync(User);

        // 不允許管理員停權自己
        // 但如果自己目前已經是 BANNED，仍允許解除停權
        if (currentUser != null &&
            currentUser.Id == member.Id &&
            member.Status == "ACTIVE")
        {
            TempData["StatusError"] =
                "不能停權自己的管理員帳號。";

            return RedirectToAction(
                nameof(Details),
                new { id });
        }

        // ACTIVE → BANNED
        if (member.Status == "ACTIVE")
        {
            member.Status = "BANNED";
        }
        // BANNED → ACTIVE
        else if (member.Status == "BANNED")
        {
            member.Status = "ACTIVE";
        }
        else
        {
            return BadRequest("目前帳號狀態不支援此操作。");
        }

        member.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(member);

        if (!result.Succeeded)
        {
            TempData["StatusError"] = "會員狀態更新失敗。";

            return RedirectToAction(
                nameof(Details),
                new { id });
        }

        return RedirectToAction(
            nameof(Details),
            new { id });
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
            Visibility = profile.Visibility,
            RowVersion = profile.RowVersion
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

        // 使用者開啟編輯頁時的版本
        _context.Entry(profile)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        profile.Nickname = model.Nickname.Trim();
        profile.Bio = model.Bio?.Trim();
        profile.AvatarPath = model.AvatarPath?.Trim();
        profile.Visibility = model.Visibility;
        profile.UpdatedAt = DateTime.UtcNow;

        try
        {
            _context.SaveChanges();

            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateConcurrencyException)
        {
            var databaseProfile = _context.UserProfiles
                .AsNoTracking()
                .SingleOrDefault(x => x.UserId == id);

            if (databaseProfile == null)
            {
                ModelState.AddModelError(
                    "",
                    "此會員資料已被其他人刪除。");

                return View(model);
            }

            model.RowVersion = databaseProfile.RowVersion;

            ModelState.Remove(nameof(model.RowVersion));

            ModelState.AddModelError(
                "",
                "此會員資料已被其他人修改，請重新確認資料後再儲存。");

            return View(model);
        }
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
            pointBalance = new PointBalance
            {
                UserId = id,
                Balance = 0,
                UpdatedAt = DateTime.UtcNow
            };

            _context.PointBalances.Add(pointBalance);
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


    public IActionResult EditAddress(Guid id)
    {
        var address = _context.UserAddresses
            .AsNoTracking()
            .SingleOrDefault(x => x.Id == id);

        if (address == null)
        {
            return NotFound();
        }

        var model = new UserAddressEditViewModel
        {
            Id = address.Id,
            UserId = address.UserId,
            AddressLabel = address.AddressLabel,
            RecipientName = address.RecipientName,
            RecipientPhone = address.RecipientPhone,
            PostalCode = address.PostalCode,
            City = address.City,
            District = address.District,
            AddressLine = address.AddressLine,
            IsDefault = address.IsDefault,
            RowVersion = address.RowVersion
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditAddress(
    Guid id,
    UserAddressEditViewModel model)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var address = await _context.UserAddresses
            .SingleOrDefaultAsync(x => x.Id == id);

        if (address == null)
        {
            return NotFound();
        }

        if (address.UserId != model.UserId)
        {
            return BadRequest();
        }

        _context.Entry(address)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            if (model.IsDefault)
            {
                var currentDefaultAddresses =
                    await _context.UserAddresses
                        .Where(x =>
                            x.UserId == model.UserId &&
                            x.Id != id &&
                            x.IsDefault)
                        .ToListAsync();

                foreach (var currentDefault in currentDefaultAddresses)
                {
                    currentDefault.IsDefault = false;
                    currentDefault.UpdatedAt = DateTime.UtcNow;
                }
            }

            address.AddressLabel = model.AddressLabel.Trim();
            address.RecipientName = model.RecipientName.Trim();
            address.RecipientPhone = model.RecipientPhone.Trim();
            address.PostalCode = model.PostalCode?.Trim();
            address.City = model.City?.Trim();
            address.District = model.District?.Trim();
            address.AddressLine = model.AddressLine.Trim();
            address.IsDefault = model.IsDefault;
            address.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return RedirectToAction(
                nameof(Details),
                new { id = model.UserId });
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync();

            var databaseAddress = await _context.UserAddresses
                .AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == id);

            if (databaseAddress == null)
            {
                ModelState.AddModelError(
                    "",
                    "此地址已被其他人刪除。");

                return View(model);
            }

            model.RowVersion = databaseAddress.RowVersion;

            ModelState.Remove(nameof(model.RowVersion));

            ModelState.AddModelError(
                "",
                "此地址已被其他人修改，請重新確認資料後再儲存。");

            return View(model);
        }
    }

    public IActionResult CreateAddress(Guid userId)
    {
        var user = _userManager.Users
            .AsNoTracking()
            .SingleOrDefault(x => x.Id == userId);

        if (user == null)
        {
            return NotFound();
        }

        var model = new UserAddressCreateViewModel
        {
            UserId = userId
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateAddress(
    UserAddressCreateViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var userExists = await _userManager.Users
            .AnyAsync(x => x.Id == model.UserId);

        if (!userExists)
        {
            return NotFound();
        }

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            // 如果新地址要設為預設地址
            // 先取消這個會員原本的預設地址
            if (model.IsDefault)
            {
                var currentDefaults = await _context.UserAddresses
                    .Where(x =>
                        x.UserId == model.UserId &&
                        x.IsDefault)
                    .ToListAsync();

                foreach (var currentDefault in currentDefaults)
                {
                    currentDefault.IsDefault = false;
                    currentDefault.UpdatedAt = DateTime.UtcNow;
                }
            }

            var address = new UserAddress
            {
                Id = Guid.NewGuid(),
                UserId = model.UserId,
                AddressLabel = model.AddressLabel.Trim(),
                RecipientName = model.RecipientName.Trim(),
                RecipientPhone = model.RecipientPhone.Trim(),
                PostalCode = model.PostalCode?.Trim(),
                City = model.City?.Trim(),
                District = model.District?.Trim(),
                AddressLine = model.AddressLine.Trim(),
                IsDefault = model.IsDefault,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.UserAddresses.Add(address);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return RedirectToAction(
                nameof(Details),
                new { id = model.UserId });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }


    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteAddress(
    Guid id,
    Guid userId)
    {
        var address = await _context.UserAddresses
            .SingleOrDefaultAsync(x =>
                x.Id == id &&
                x.UserId == userId);

        if (address == null)
        {
            return NotFound();
        }

        if (address.IsDefault)
        {
            TempData["AddressError"] =
                "預設地址不能直接刪除，請先將其他地址設為預設地址。";

            return RedirectToAction(
                nameof(Details),
                new { id = userId });
        }

        _context.UserAddresses.Remove(address);
        await _context.SaveChangesAsync();

        return RedirectToAction(
            nameof(Details),
            new { id = userId });
    }


    //    會員 id
    //→ UserManager 找會員
    //→ RoleManager 查所有角色
    //→ UserManager 查這會員目前角色
    //→ 丟到 MemberRoleEditViewModel
    public async Task<IActionResult> EditRoles(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());

        if (user == null)
        {
            return NotFound();
        }

        var availableRoles = await _roleManager.Roles
            .Select(x => x.Name!)
            .OrderBy(x => x)
            .ToListAsync();

        var selectedRoles = await _userManager.GetRolesAsync(user);

        var model = new MemberRoleEditViewModel
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            AvailableRoles = availableRoles,
            SelectedRole = selectedRoles.FirstOrDefault() ?? ""
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditRoles(MemberRoleEditViewModel model)
    {
        var user = await _userManager.FindByIdAsync(model.UserId.ToString());

        if (user == null)
        {
            return NotFound();
        }

        var availableRoles = await _roleManager.Roles
            .Select(x => x.Name!)
            .ToListAsync();

        // 防止手動送出不存在的角色
        if (!availableRoles.Contains(model.SelectedRole))
        {
            model.Email = user.Email ?? "";
            model.AvailableRoles = availableRoles;

            ModelState.AddModelError(
                nameof(model.SelectedRole),
                "請選擇有效的角色。");

            return View(model);
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        // 先移除目前所有角色
        if (currentRoles.Count > 0)
        {
            var removeResult =
                await _userManager.RemoveFromRolesAsync(
                    user,
                    currentRoles);

            if (!removeResult.Succeeded)
            {
                model.Email = user.Email ?? "";
                model.AvailableRoles = availableRoles;

                foreach (var error in removeResult.Errors)
                {
                    ModelState.AddModelError("", error.Description);
                }

                return View(model);
            }
        }

        // 再加入使用者選擇的單一角色
        var addResult =
            await _userManager.AddToRoleAsync(
                user,
                model.SelectedRole);

        if (!addResult.Succeeded)
        {
            model.Email = user.Email ?? "";
            model.AvailableRoles = availableRoles;

            foreach (var error in addResult.Errors)
            {
                ModelState.AddModelError("", error.Description);
            }

            return View(model);
        }

        return RedirectToAction(
            nameof(Details),
            new { id = model.UserId });
    }


    public async Task<IActionResult> GrantAchievement(Guid userId)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());

        if (user == null)
        {
            return NotFound();
        }

        var achievementItems = await _context.Achievements
            .AsNoTracking()
            .Where(x => x.Status == "ACTIVE")
            .OrderBy(x => x.Name)
            .Select(x => new Microsoft.AspNetCore.Mvc.Rendering.SelectListItem
            {
                Value = x.Id.ToString(),
                Text = x.Name
            })
            .ToListAsync();

        var model = new GrantAchievementViewModel
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            AvailableAchievements = achievementItems
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> GrantAchievement(
    GrantAchievementViewModel model)
    {
        var user = await _userManager.FindByIdAsync(
            model.UserId.ToString());

        if (user == null)
        {
            return NotFound();
        }

        var achievement = await _context.Achievements
            .AsNoTracking()
            .SingleOrDefaultAsync(x =>
                x.Id == model.AchievementId &&
                x.Status == "ACTIVE");

        if (achievement == null)
        {
            ModelState.AddModelError(
                nameof(model.AchievementId),
                "請選擇有效且啟用中的成就。");
        }

        var alreadyExists = await _context.UserAchievements
            .AnyAsync(x =>
                x.UserId == model.UserId &&
                x.AchievementId == model.AchievementId);

        if (alreadyExists)
        {
            ModelState.AddModelError(
                nameof(model.AchievementId),
                "此會員已經取得過這個成就。");
        }

        if (!ModelState.IsValid)
        {
            model.Email = user.Email ?? "";

            model.AvailableAchievements =
                await _context.Achievements
                    .AsNoTracking()
                    .Where(x => x.Status == "ACTIVE")
                    .OrderBy(x => x.Name)
                    .Select(x =>
                        new Microsoft.AspNetCore.Mvc.Rendering.SelectListItem
                        {
                            Value = x.Id.ToString(),
                            Text = x.Name
                        })
                    .ToListAsync();

            return View(model);
        }

        var userAchievement = new UserAchievement
        {
            Id = Guid.NewGuid(),
            UserId = model.UserId,
            AchievementId = model.AchievementId,
            AchievedAt = DateTime.UtcNow,
            IsDisplayed = false,
            DisplayedAt = null
        };

        _context.UserAchievements.Add(userAchievement);

        await _context.SaveChangesAsync();

        return RedirectToAction(
            nameof(Details),
            new { id = model.UserId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> RemoveAchievement(
    Guid id,
    Guid userId,
    string rowVersion)
    {
        var userAchievement = await _context.UserAchievements
            .SingleOrDefaultAsync(x =>
                x.Id == id &&
                x.UserId == userId);

        if (userAchievement == null)
        {
            TempData["ErrorMessage"] =
                "這筆會員成就已被其他操作移除，請重新確認。";

            return RedirectToAction(
                nameof(Details),
                new { id = userId });
        }

        // 把畫面送回來的 RowVersion 轉回 byte[]
        byte[] originalRowVersion;

        try
        {
            originalRowVersion = Convert.FromBase64String(rowVersion);
        }
        catch (FormatException)
        {
            return BadRequest();
        }

        // 告訴 EF：
        // 使用者看到這筆資料時，是這個版本
        _context.Entry(userAchievement)
            .Property(x => x.RowVersion)
            .OriginalValue = originalRowVersion;

        _context.UserAchievements.Remove(userAchievement);

        try
        {
            await _context.SaveChangesAsync();

            TempData["SuccessMessage"] = "會員成就已成功移除。";
        }
        catch (DbUpdateConcurrencyException)
        {
            TempData["ErrorMessage"] =
                "這筆會員成就已被其他操作修改或移除，請重新確認。";
        }

        return RedirectToAction(
            nameof(Details),
            new { id = userId });
    }

}