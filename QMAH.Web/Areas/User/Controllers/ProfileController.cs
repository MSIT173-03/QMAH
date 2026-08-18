using DocumentFormat.OpenXml.Office2010.Excel;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;
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


    // =========================
    // 我的個人資料
    // =========================
    public async Task<IActionResult> Index()
    {
        // 永遠從登入狀態取得本人
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        // 查自己的 Profile
        var profile = await _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == user.Id);

        if (profile == null)
        {
            return NotFound();
        }

        // 查自己的收件地址
        var addresses = await _context.UserAddresses
            .AsNoTracking()
            .Where(x => x.UserId == user.Id)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.AddressLabel)
            .ToListAsync();

        var pointBalance = await _context.PointBalances
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == user.Id);

        var recentPointTransactions = await _context.PointTransactions
            .AsNoTracking()
            .Where(x => x.UserId == user.Id)
            .OrderByDescending(x => x.CreatedAt)
            .Take(5)
            .ToListAsync();

        var achievementCount = await _context.UserAchievements
            .AsNoTracking()
            .CountAsync(x => x.UserId == user.Id);

        var model = new ProfileIndexViewModel
        {
            User = user,
            Profile = profile,
            Addresses = addresses,

            PointBalance = pointBalance?.Balance ?? 0,
            RecentPointTransactions = recentPointTransactions,
            AchievementCount = achievementCount
        };

        return View(model);
    }


    // =========================
    // 編輯我的個人資料 GET
    // =========================
    public async Task<IActionResult> Edit()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        var profile = await _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == user.Id);

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


    // =========================
    // 編輯我的個人資料 POST
    // =========================
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(MemberEditViewModel model)
    {
        // 永遠從登入狀態取得本人
        // 不相信網址或表單傳來的 UserId
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        var profile = await _context.UserProfiles
            .SingleOrDefaultAsync(x => x.UserId == user.Id);

        if (profile == null)
        {
            return NotFound();
        }

        // Email 不讓使用者修改
        model.Email = user.Email ?? "";

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // RowVersion 並行控制
        _context.Entry(profile)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        profile.Nickname = model.Nickname.Trim();
        profile.Bio = model.Bio?.Trim();
        profile.Visibility = model.Visibility;
        profile.UpdatedAt = DateTime.UtcNow;

        if (model.AvatarFile != null && model.AvatarFile.Length > 0)
        {
            // 允許的圖片副檔名
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };

            var extension = Path.GetExtension(
                model.AvatarFile.FileName
            ).ToLowerInvariant();

            if (!allowedExtensions.Contains(extension))
            {
                ModelState.AddModelError(
                    nameof(model.AvatarFile),
                    "只允許上傳 JPG、JPEG、PNG 或 WEBP 圖片。"
                );

                return View(model);
            }

            // 最大 5 MB
            if (model.AvatarFile.Length > 5 * 1024 * 1024)
            {
                ModelState.AddModelError(
                    nameof(model.AvatarFile),
                    "圖片大小不能超過 5 MB。"
                );

                return View(model);
            }

            // wwwroot/uploads/avatars
            var uploadFolder = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "avatars"
            );

            Directory.CreateDirectory(uploadFolder);

            // 產生新的檔名，避免同名圖片互相覆蓋
            var fileName =
                $"{Guid.NewGuid()}{extension}";

            var filePath = Path.Combine(
                uploadFolder,
                fileName
            );

            await using (var stream =
                new FileStream(filePath, FileMode.Create))
            {
                await model.AvatarFile.CopyToAsync(stream);
            }

            // 資料庫只存網站路徑
            profile.AvatarPath =
                $"/uploads/avatars/{fileName}";
        }

        try
        {
            await _context.SaveChangesAsync();

            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            var databaseProfile = await _context.UserProfiles
                .AsNoTracking()
                .SingleOrDefaultAsync(x => x.UserId == user.Id);

            if (databaseProfile == null)
            {
                return NotFound();
            }

            model.RowVersion = databaseProfile.RowVersion;

            ModelState.Remove(nameof(model.RowVersion));

            ModelState.AddModelError(
                "",
                "你的個人資料已被其他操作修改，請重新確認後再儲存。"
            );

            return View(model);
        }
    }

    public async Task<IActionResult> CreateAddress()
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        var model = new UserAddressCreateViewModel
        {
            UserId = user.Id
        };

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CreateAddress(
     UserAddressCreateViewModel model)
    {
        // 永遠從登入狀態取得本人
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        // 不相信表單傳來的 UserId
        model.UserId = user.Id;

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            // 如果新地址要設為預設
            // 先取消本人原本的預設地址
            if (model.IsDefault)
            {
                var oldDefaults = await _context.UserAddresses
                    .Where(x =>
                        x.UserId == user.Id &&
                        x.IsDefault)
                    .ToListAsync();

                foreach (var item in oldDefaults)
                {
                    item.IsDefault = false;
                    item.UpdatedAt = DateTime.UtcNow;
                }

                // 先把舊預設真的寫進資料庫
                await _context.SaveChangesAsync();
            }

            var address = new UserAddress
            {
                Id = Guid.NewGuid(),

                // 一定是目前登入者
                UserId = user.Id,

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

            return RedirectToAction(nameof(Index));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }


    public async Task<IActionResult> EditAddress(Guid id)
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        // 只能取得「目前登入者自己的地址」
        var address = await _context.UserAddresses
            .AsNoTracking()
            .SingleOrDefaultAsync(x =>
                x.Id == id &&
                x.UserId == user.Id);

        if (address == null)
        {
            return NotFound();
        }

        var model = new UserAddressEditViewModel
        {
            Id = address.Id,
            UserId = user.Id,
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
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        if (id != model.Id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        // 只能修改目前登入者自己的地址
        var address = await _context.UserAddresses
            .SingleOrDefaultAsync(x =>
                x.Id == id &&
                x.UserId == user.Id);

        if (address == null)
        {
            return NotFound();
        }

        // RowVersion 並行控制
        _context.Entry(address)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            // 如果這筆要設成預設地址
            if (model.IsDefault)
            {
                var oldDefaults = await _context.UserAddresses
                    .Where(x =>
                        x.UserId == user.Id &&
                        x.Id != id &&
                        x.IsDefault)
                    .ToListAsync();

                foreach (var item in oldDefaults)
                {
                    item.IsDefault = false;
                    item.UpdatedAt = DateTime.UtcNow;
                }

                // ★ 重點
                // 先把原本的預設地址取消
                // 避免資料庫瞬間出現兩筆預設地址
                if (oldDefaults.Count > 0)
                {
                    await _context.SaveChangesAsync();
                }
            }

            // 再修改目前這筆地址
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

            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync();

            var databaseAddress = await _context.UserAddresses
                .AsNoTracking()
                .SingleOrDefaultAsync(x =>
                    x.Id == id &&
                    x.UserId == user.Id);

            if (databaseAddress == null)
            {
                return NotFound();
            }

            model.RowVersion = databaseAddress.RowVersion;

            ModelState.Remove(nameof(model.RowVersion));

            ModelState.AddModelError(
                "",
                "這筆地址已被其他操作修改，請重新確認後再儲存。");

            return View(model);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteAddress(Guid id)
    {
        var user = await _userManager.GetUserAsync(User);

        if (user == null)
        {
            return Challenge();
        }

        // 只能刪除目前登入者自己的地址
        var address = await _context.UserAddresses
            .SingleOrDefaultAsync(x =>
                x.Id == id &&
                x.UserId == user.Id);

        if (address == null)
        {
            return NotFound();
        }

        // 預設地址不能直接刪除
        if (address.IsDefault)
        {
            TempData["AddressError"] =
                "預設地址不能直接刪除，請先將其他地址設為預設地址。";

            return RedirectToAction(nameof(Index));
        }

        _context.UserAddresses.Remove(address);

        await _context.SaveChangesAsync();

        return RedirectToAction(nameof(Index));
    }

}