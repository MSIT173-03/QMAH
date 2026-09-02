using Microsoft.AspNetCore.Authorization; //登入權限
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Infrastructure.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Infrastructure.Models.Identity;
using QMAH.Infrastructure.Services.Economy;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
[AdminNavigation("會員帳號", 10)]
public class MembersController : Controller
{
    private static readonly int[] PageSizes = [10, 20, 50, 100];
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly QmahDbContext _context;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;
    private readonly EconomyService _economyService;

    public MembersController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        QmahDbContext context,
        RoleManager<IdentityRole<Guid>> roleManager,
        EconomyService economyService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
        _roleManager = roleManager;
        _economyService = economyService;
    }

    // 先查會員基本資料，再批次補上個人資料、點數與角色，避免每列各打一次 Identity 查詢
    public async Task<IActionResult> Index(
    string? keyword,
    string? role,
    string? status,
    int page = 1,
    int pageSize = 10,
    CancellationToken cancellationToken = default)
    {
        pageSize = PageSizes.Contains(pageSize) ? pageSize : 10;
        // 避免 page 小於 1
        page = Math.Max(1, page);
        keyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
        role = string.IsNullOrWhiteSpace(role) ? null : role.Trim();
        status = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();

        // 先查帳號
        var query = _userManager.Users.AsNoTracking();

        // 關鍵字搜尋
        if (keyword is not null)
        {
            query = query.Where(x =>
                (x.Email != null && x.Email.Contains(keyword)) ||
                (x.UserName != null && x.UserName.Contains(keyword))
            );
        }

        // 狀態篩選
        if (status is not null)
        {
            query = query.Where(x => x.Status == status);
        }

        var users = await query
            .OrderBy(x => x.Email)
            .ToListAsync(cancellationToken);

        var userIds = users.Select(user => user.Id).ToArray();
        // 三份附加資料一次載入後用字典對照，避免列表常見的 N+1 查詢
        var profiles = await _context.UserProfiles
            .AsNoTracking()
            .Where(profile => userIds.Contains(profile.UserId))
            .ToDictionaryAsync(profile => profile.UserId, cancellationToken);
        var pointBalances = await _context.PointBalances
            .AsNoTracking()
            .Where(balance => userIds.Contains(balance.UserId))
            .ToDictionaryAsync(balance => balance.UserId, cancellationToken);
        var roleRows = await (
            from userRole in _context.UserRoles.AsNoTracking()
            join roleEntity in _context.Roles.AsNoTracking()
                on userRole.RoleId equals roleEntity.Id
            where userIds.Contains(userRole.UserId)
            select new { userRole.UserId, Role = roleEntity.Name }
        ).ToListAsync(cancellationToken);
        var rolesByUser = roleRows
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .Select(row => row.Role)
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Cast<string>()
                    .ToList());

        // 先組合 User + Role + Point
        var allMembers = users
            .Select(user =>
            {
                var userRole = rolesByUser.TryGetValue(user.Id, out var roles)
                    ? roles.FirstOrDefault(value => value == "Admin") ?? roles.FirstOrDefault() ?? "Member"
                    : "Member";
                profiles.TryGetValue(user.Id, out var profile);
                pointBalances.TryGetValue(user.Id, out var pointBalance);

                return new MemberListItemViewModel
                {
                    User = user,
                    Role = userRole,
                    PointBalance = pointBalance?.Balance ?? 0,
                    Nickname = profile?.Nickname,
                    AvatarPath = profile?.AvatarPath
                };
            })
            // 角色篩選
            .Where(member => role is null || member.Role == role)
            .ToList();

        // 角色也篩完之後，才算總筆數
        // 先補齊角色名稱再篩選，總筆數才會和畫面結果一致
        int totalCount = allMembers.Count;

        int totalPages = (int)Math.Ceiling(
            totalCount / (double)pageSize
        );

        // 避免超過最後一頁
        if (totalPages > 0 && page > totalPages)
        {
            page = totalPages;
        }

        // 最後才分頁
        // 最後才分頁，避免角色篩選因頁面大小漏掉會員
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
        // 統計卡代表全體會員，不跟目前頁面的筆數混在一起
        var now = DateTime.UtcNow;
        var thirtyDaysAgo = now.AddDays(-30);
        ViewBag.TotalMembers = await _userManager.Users.CountAsync(cancellationToken);
        ViewBag.NewMembers = await _userManager.Users
            .CountAsync(x => x.CreatedAt >= thirtyDaysAgo, cancellationToken);
        ViewBag.BannedMembers = await _userManager.Users
            .CountAsync(x => x.Status == "BANNED", cancellationToken);

        return View(members);
    }

    public async Task<IActionResult> Details(Guid id)
    {
        var user = await _userManager.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var roles = await _userManager.GetRolesAsync(user);

        var profile = await _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == id);

        var addresses = await _context.UserAddresses
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.IsDefault)
            .ToListAsync();

        var pointBalance = await _context.PointBalances
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == id);

        var pointTransactions = await _context.PointTransactions
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .ToListAsync();

        var achievements = await _context.UserAchievements
            .AsNoTracking()
            .Include(x => x.Achievement)
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.AchievedAt)
            .ToListAsync();
        var equippedTitle = await _economyService.GetEquippedTitleAsync(id);

        var model = new MemberDetailsViewModel
        {
            User = user,
            Profile = profile,
            Addresses = addresses,
            Achievements = achievements,
            EquippedTitle = equippedTitle,
            PointTransactions = pointTransactions,
            CurrentBalance = pointBalance?.Balance ?? 0,
            Roles = roles.ToList()
        };

        return View(model);
    }

    /// <summary>設定或清除會員目前配戴的成就稱號，只能選擇該會員已取得的成就。</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> SetEquippedTitle(
        Guid id,
        Guid? userAchievementId,
        CancellationToken cancellationToken = default)
    {
        if (!await _userManager.Users.AnyAsync(user => user.Id == id, cancellationToken))
            return NotFound();

        var result = await _economyService.SetEquippedTitleAsync(id, userAchievementId, cancellationToken);
        TempData[result.Succeeded ? "SuccessMessage" : "ErrorMessage"] =
            result.Succeeded ? "會員配戴稱號已更新。" : result.ErrorMessage ?? "會員配戴稱號更新失敗。";
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpGet]
    public IActionResult ChangePassword()
    {
        return View(new ChangeOwnPasswordViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(ChangeOwnPasswordViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var currentUser = await _userManager.GetUserAsync(User);
        if (currentUser == null)
        {
            return Challenge();
        }

        var result = await _userManager.ChangePasswordAsync(
            currentUser, model.CurrentPassword, model.NewPassword);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(string.Empty, PasswordError(error));
            }

            return View(model);
        }

        await _signInManager.RefreshSignInAsync(currentUser);
        TempData["SuccessMessage"] = "管理員密碼已更新。";
        return RedirectToAction(nameof(ChangePassword));
    }

    [HttpGet]
    public async Task<IActionResult> ResetPassword(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user == null || !await _userManager.IsInRoleAsync(user, "User"))
        {
            return NotFound();
        }

        return View(new ResetMemberPasswordViewModel
        {
            UserId = user.Id,
            Email = user.Email ?? ""
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetPassword(Guid id, ResetMemberPasswordViewModel model)
    {
        if (id != model.UserId)
        {
            return BadRequest();
        }

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user == null || !await _userManager.IsInRoleAsync(user, "User"))
        {
            return NotFound();
        }

        model.Email = user.Email ?? "";
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, model.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(string.Empty, PasswordError(error));
            }

            return View(model);
        }

        TempData["SuccessMessage"] = $"{user.Email} 的密碼已重設。";
        return RedirectToAction(nameof(Details), new { id });
    }

    private static string PasswordError(IdentityError error) => error.Code switch
    {
        "PasswordRequiresNonAlphanumeric" => "密碼至少需要一個特殊符號，例如 ! @ # $。",
        "PasswordRequiresLower" => "密碼至少需要一個小寫英文字母。",
        "PasswordRequiresUpper" => "密碼至少需要一個大寫英文字母。",
        "PasswordRequiresDigit" => "密碼至少需要一個數字。",
        "PasswordTooShort" => "密碼長度不足。",
        _ => error.Description
    };

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
        // 狀態變更要立即讓既有登入 cookie 失效，避免停權會員繼續使用已建立的工作階段。
        member.SecurityStamp = Guid.NewGuid().ToString("N");

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
    public async Task<IActionResult> Edit(Guid id, MemberEditViewModel model)
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
        profile.Visibility = model.Visibility;
        profile.UpdatedAt = DateTime.UtcNow;

        // 管理員有選新頭像才更換
        if (model.AvatarFile != null &&
            model.AvatarFile.Length > 0)
        {
            var extension = Path.GetExtension(
                model.AvatarFile.FileName
            ).ToLowerInvariant();

            var allowedExtensions = new[]
            {
        ".jpg", ".jpeg", ".png", ".webp"
    };

            if (!allowedExtensions.Contains(extension))
            {
                ModelState.AddModelError(
                    nameof(model.AvatarFile),
                    "只允許 JPG、JPEG、PNG、WEBP 圖片。"
                );

                return View(model);
            }

            if (model.AvatarFile.Length > 5 * 1024 * 1024)
            {
                ModelState.AddModelError(
                    nameof(model.AvatarFile),
                    "圖片大小不能超過 5 MB。"
                );

                return View(model);
            }

            var fileName =
                $"{Guid.NewGuid()}{extension}";

            var folderPath = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "avatars"
            );

            Directory.CreateDirectory(folderPath);

            var filePath = Path.Combine(
                folderPath,
                fileName
            );

            await using var stream =
                new FileStream(
                    filePath,
                    FileMode.Create
                );

            await model.AvatarFile.CopyToAsync(stream);

            profile.AvatarPath =
                $"/uploads/avatars/{fileName}";
        }

        try
        {
            await _context.SaveChangesAsync();

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
    PointAdjustViewModel model,
    CancellationToken cancellationToken = default)
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

        if (!ModelState.IsValid)
        {
            model.Email = user.Email ?? "";
            model.CurrentBalance = await _context.PointBalances
                .Where(balance => balance.UserId == id)
                .Select(balance => (int?)balance.Balance)
                .SingleOrDefaultAsync(cancellationToken) ?? 0;

            return View(model);
        }

        // 原本此處直接更新 PointBalance；現改由 EconomyService 以同一交易寫入餘額與 PointTransaction。
        var result = await _economyService.AdjustPointsAsync(
            id,
            model.Amount,
            model.Reason,
            cancellationToken: cancellationToken);
        if (!result.Succeeded)
        {
            ModelState.AddModelError("", result.ErrorMessage ?? "點數異動未完成。" );
            model.Email = user.Email ?? "";
            model.CurrentBalance = await _context.PointBalances
                .AsNoTracking()
                .Where(balance => balance.UserId == id)
                .Select(balance => (int?)balance.Balance)
                .SingleOrDefaultAsync(cancellationToken) ?? 0;
            return View(model);
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
            Latitude = address.Latitude,
            Longitude = address.Longitude,
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
        if (model.Latitude.HasValue != model.Longitude.HasValue)
        {
            ModelState.AddModelError(nameof(model.Latitude), "地點座標必須同時填寫緯度與經度；也可以兩者都留白。");
        }

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

                // 先讓舊預設地址真的變成 false
                if (currentDefaultAddresses.Count > 0)
                {
                    await _context.SaveChangesAsync();
                }
            }

            address.AddressLabel = model.AddressLabel.Trim();
            address.RecipientName = model.RecipientName.Trim();
            address.RecipientPhone = model.RecipientPhone.Trim();
            address.PostalCode = model.PostalCode?.Trim();
            address.City = model.City?.Trim();
            address.District = model.District?.Trim();
            address.Latitude = model.Latitude;
            address.Longitude = model.Longitude;
            address.AddressLine = model.AddressLine.Trim();
            address.IsDefault = model.IsDefault;
            address.UpdatedAt = DateTime.UtcNow;

            // 再儲存新的預設地址
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
        if (model.Latitude.HasValue != model.Longitude.HasValue)
        {
            ModelState.AddModelError(nameof(model.Latitude), "地點座標必須同時填寫緯度與經度；也可以兩者都留白。");
        }

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
                Latitude = model.Latitude,
                Longitude = model.Longitude,
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
