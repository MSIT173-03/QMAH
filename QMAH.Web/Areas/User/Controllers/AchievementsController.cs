using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
[AdminNavigation("成就設定", 30)]
public class AchievementsController : Controller
{
    private readonly QmahDbContext _context;

    public AchievementsController(QmahDbContext context)
    {
        _context = context;
    }

    public IActionResult Index()
    {
        var achievements = _context.Achievements
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToList();

        var result = new List<AchievementListItemViewModel>();

        foreach (var achievement in achievements)
        {
            var earnedCount = _context.UserAchievements
                .AsNoTracking()
                .Count(x => x.AchievementId == achievement.Id);

            result.Add(new AchievementListItemViewModel
            {
                Achievement = achievement,
                EarnedCount = earnedCount
            });
        }

        return View(result);
    }
    public IActionResult Edit(Guid id)
    {
        var achievement = _context.Achievements
            .AsNoTracking()
            .SingleOrDefault(x => x.Id == id);

        if (achievement == null)
        {
            return NotFound();
        }

        var model = new AchievementEditViewModel
        {
            Id = achievement.Id,
            Code = achievement.Code,
            Name = achievement.Name,
            Title = achievement.Title,
            Description = achievement.Description,
            IconPath = achievement.IconPath,
            ConditionType = achievement.ConditionType,
            ThresholdValue = achievement.ThresholdValue,
            Status = achievement.Status,
            RowVersion = achievement.RowVersion
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
       Guid id,
       AchievementEditViewModel model)
    {
        if (id != model.Id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var achievement = await _context.Achievements
            .SingleOrDefaultAsync(x => x.Id == id);

        if (achievement == null)
        {
            return NotFound();
        }

        _context.Entry(achievement)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        achievement.Code = model.Code.Trim();
        achievement.Name = model.Name.Trim();
        achievement.Title = model.Title.Trim();
        achievement.Description = model.Description?.Trim();
        achievement.ConditionType = model.ConditionType.Trim();
        achievement.ThresholdValue = model.ThresholdValue;
        achievement.Status = model.Status;
        achievement.UpdatedAt = DateTime.UtcNow;

        // 有選新圖片才更換圖示
        if (model.IconFile != null && model.IconFile.Length > 0)
        {
            var allowedExtensions =
                new[] { ".jpg", ".jpeg", ".png", ".webp" };

            var extension = Path.GetExtension(
                model.IconFile.FileName
            ).ToLowerInvariant();

            if (!allowedExtensions.Contains(extension))
            {
                ModelState.AddModelError(
                    nameof(model.IconFile),
                    "只允許 JPG、JPEG、PNG 或 WEBP 圖片。"
                );

                return View(model);
            }

            if (model.IconFile.Length > 5 * 1024 * 1024)
            {
                ModelState.AddModelError(
                    nameof(model.IconFile),
                    "圖片大小不能超過 5 MB。"
                );

                return View(model);
            }

            var uploadFolder = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "achievements"
            );

            Directory.CreateDirectory(uploadFolder);

            var fileName =
                $"{Guid.NewGuid()}{extension}";

            var filePath = Path.Combine(
                uploadFolder,
                fileName
            );

            await using (var stream =
                new FileStream(filePath, FileMode.Create))
            {
                await model.IconFile.CopyToAsync(stream);
            }

            achievement.IconPath =
                $"/uploads/achievements/{fileName}";
        }

        try
        {
            await _context.SaveChangesAsync();

            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            var databaseAchievement =
                await _context.Achievements
                    .AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Id == id);

            if (databaseAchievement == null)
            {
                ModelState.AddModelError(
                    "",
                    "此成就已被其他人刪除。"
                );

                return View(model);
            }

            model.RowVersion = databaseAchievement.RowVersion;
            model.IconPath = databaseAchievement.IconPath;

            ModelState.Remove(nameof(model.RowVersion));

            ModelState.AddModelError(
                "",
                "此成就已被其他人修改，請重新確認資料後再儲存。"
            );

            return View(model);
        }
    }

    public IActionResult Create()
    {
        var model = new AchievementCreateViewModel
        {
            Status = "ACTIVE"
        };

        return View(model);
    }
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(AchievementCreateViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        bool codeExists = _context.Achievements
            .Any(x => x.Code == model.Code);

        string? iconPath = null;

        if (model.IconFile != null && model.IconFile.Length > 0)
        {
            var allowedExtensions =
                new[] { ".jpg", ".jpeg", ".png", ".webp" };

            var extension = Path.GetExtension(
                model.IconFile.FileName
            ).ToLowerInvariant();

            if (!allowedExtensions.Contains(extension))
            {
                ModelState.AddModelError(
                    nameof(model.IconFile),
                    "只允許 JPG、JPEG、PNG 或 WEBP 圖片。"
                );

                return View(model);
            }

            if (model.IconFile.Length > 5 * 1024 * 1024)
            {
                ModelState.AddModelError(
                    nameof(model.IconFile),
                    "圖片大小不能超過 5 MB。"
                );

                return View(model);
            }

            var uploadFolder = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "achievements"
            );

            Directory.CreateDirectory(uploadFolder);

            var fileName =
                $"{Guid.NewGuid()}{extension}";

            var filePath = Path.Combine(
                uploadFolder,
                fileName
            );

            await using (var stream =
                new FileStream(filePath, FileMode.Create))
            {
                await model.IconFile.CopyToAsync(stream);
            }

            iconPath =
                $"/uploads/achievements/{fileName}";
        }

        if (codeExists)
        {
            ModelState.AddModelError(
                nameof(model.Code),
                "此成就代碼已存在。"
            );

            return View(model);
        }

        var achievement = new Achievement
        {
            Id = Guid.NewGuid(),
            Code = model.Code.Trim(),
            Name = model.Name.Trim(),
            Title = model.Title.Trim(),
            Description = model.Description?.Trim(),
            IconPath = iconPath,
            ConditionType = model.ConditionType.Trim(),
            ThresholdValue = model.ThresholdValue,
            Status = model.Status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Achievements.Add(achievement);
        await _context.SaveChangesAsync();

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult ChangeStatus(Guid id)
    {
        var achievement = _context.Achievements
            .SingleOrDefault(x => x.Id == id);

        if (achievement == null)
        {
            return NotFound();
        }

        // ACTIVE → INACTIVE
        // INACTIVE → ACTIVE
        if (achievement.Status == "ACTIVE")
        {
            achievement.Status = "INACTIVE";
        }
        else if (achievement.Status == "INACTIVE")
        {
            achievement.Status = "ACTIVE";
        }

        achievement.UpdatedAt = DateTime.UtcNow;

        _context.SaveChanges();

        return RedirectToAction(nameof(Index));
    }

}
