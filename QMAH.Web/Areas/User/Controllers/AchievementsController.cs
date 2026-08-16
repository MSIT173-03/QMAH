using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
[Authorize(Roles = "Admin")]
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
    public IActionResult Edit(
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

        var achievement = _context.Achievements
            .SingleOrDefault(x => x.Id == id);

        if (achievement == null)
        {
            return NotFound();
        }

        // 告訴 EF：
        // 使用者開啟編輯頁面時，資料的版本是 model.RowVersion
        _context.Entry(achievement)
            .Property(x => x.RowVersion)
            .OriginalValue = model.RowVersion;

        achievement.Code = model.Code.Trim();
        achievement.Name = model.Name.Trim();
        achievement.Title = model.Title.Trim();
        achievement.Description = model.Description?.Trim();
        achievement.IconPath = model.IconPath?.Trim();
        achievement.ConditionType = model.ConditionType.Trim();
        achievement.ThresholdValue = model.ThresholdValue;
        achievement.Status = model.Status;
        achievement.UpdatedAt = DateTime.UtcNow;

        try
        {
            _context.SaveChanges();

            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            var databaseAchievement = _context.Achievements
                .AsNoTracking()
                .SingleOrDefault(x => x.Id == id);

            if (databaseAchievement == null)
            {
                ModelState.AddModelError(
                    "",
                    "此成就已被其他人刪除。");

                return View(model);
            }

            // 更新成目前資料庫最新版本，
            // 讓使用者重新確認後可以再次送出
            model.RowVersion = databaseAchievement.RowVersion;

            ModelState.Remove(nameof(model.RowVersion));
            ModelState.AddModelError(
                "",
                "此成就已被其他人修改，請重新確認資料後再儲存。");

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
    public IActionResult Create(AchievementCreateViewModel model)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        bool codeExists = _context.Achievements
            .Any(x => x.Code == model.Code);

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
            IconPath = model.IconPath?.Trim(),
            ConditionType = model.ConditionType.Trim(),
            ThresholdValue = model.ThresholdValue,
            Status = model.Status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Achievements.Add(achievement);
        _context.SaveChanges();

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