using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.User.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.User.Controllers;

[Area("User")]
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
            Status = achievement.Status
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

        achievement.Code = model.Code.Trim();
        achievement.Name = model.Name.Trim();
        achievement.Title = model.Title.Trim();
        achievement.Description = model.Description?.Trim();
        achievement.IconPath = model.IconPath?.Trim();
        achievement.ConditionType = model.ConditionType.Trim();
        achievement.ThresholdValue = model.ThresholdValue;
        achievement.Status = model.Status;
        achievement.UpdatedAt = DateTime.UtcNow;

        _context.SaveChanges();

        return RedirectToAction(nameof(Index));
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