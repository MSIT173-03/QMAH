using System.Text.Json;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Game.Controllers;

/// <summary>維護多人主遊戲與 Mini Game 使用的資料化經濟設定。</summary>
[Area("Game")]
[Authorize(Roles = "Admin")]
[Route("game/economy")]
[AdminNavigation("經濟設定", 50)]
public sealed class GameEconomyController(QmahDbContext db) : Controller
{
    /// <summary>顯示主遊戲設定與目前四種 Mini Game 模式。</summary>
    [HttpGet("")]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(CancellationToken cancellationToken = default)
    {
        var setting = await db.GameEconomySettings
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == 1, cancellationToken)
            ?? DefaultSetting();
        var modes = await db.GameModeDefinitions
            .AsNoTracking()
            .OrderBy(item => item.Code)
            .ToListAsync(cancellationToken);
        return View("~/Areas/Game/Views/Home/Economy.cshtml", new GameEconomyPageViewModel
        {
            Economy = GameEconomyEditViewModel.From(setting),
            Modes = modes
        });
    }

    /// <summary>儲存主遊戲獎勵、每日 Mini Game 上限與鑰匙進度門檻。</summary>
    [HttpPost("Save")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Save(
        [Bind(Prefix = "Economy")] GameEconomyEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        ValidateEconomy(model);
        if (!ModelState.IsValid)
            return await ReturnIndexWithErrorsAsync(model, cancellationToken);

        var setting = await db.GameEconomySettings.SingleOrDefaultAsync(item => item.Id == 1, cancellationToken);
        if (setting is null)
        {
            setting = new GameEconomySetting { Id = 1 };
            db.GameEconomySettings.Add(setting);
        }
        else
        {
            db.Entry(setting).Property(item => item.RowVersion).OriginalValue = model.RowVersion;
        }

        setting.MinimumPointReward = model.MinimumPointReward;
        setting.MaximumPointReward = model.MaximumPointReward;
        setting.BasePointReward = model.BasePointReward;
        setting.MaximumVoteBonus = model.MaximumVoteBonus;
        setting.MaximumWinBonus = model.MaximumWinBonus;
        setting.CompletedNormalKey = model.CompletedNormalKey;
        setting.ExcellentExtraNormalKey = model.ExcellentExtraNormalKey;
        setting.ExcellentThreshold = model.ExcellentThreshold;
        setting.DailyMiniGameRewardLimit = model.DailyMiniGameRewardLimit;
        setting.KeyProgressToNormalKey = model.KeyProgressToNormalKey;
        setting.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["SuccessMessage"] = "主遊戲經濟設定已更新。";
            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "主遊戲經濟設定已被其他管理員修改，請重新載入後再試。");
            return await ReturnIndexWithErrorsAsync(model, cancellationToken);
        }
    }

    /// <summary>顯示單一 Mini Game 模式的編輯表單。</summary>
    [HttpGet("Mode/{id:guid}")]
    public async Task<IActionResult> EditMode(Guid id, CancellationToken cancellationToken = default)
    {
        var mode = await db.GameModeDefinitions.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return mode is null ? NotFound() : View("~/Areas/Game/Views/Home/Mode.cshtml", GameModeEditViewModel.From(mode));
    }

    /// <summary>儲存 Mini Game 模式的門檻、獎勵與素材設定。</summary>
    [HttpPost("Mode/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EditMode(
        Guid id,
        GameModeEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (id != model.Id)
            return BadRequest();

        model.Code = model.Code.Trim().ToUpperInvariant();
        model.Name = model.Name.Trim();
        model.Description = model.Description.Trim();
        model.ConfigJson = string.IsNullOrWhiteSpace(model.ConfigJson) ? null : model.ConfigJson.Trim();
        ValidateMode(model);
        if (!ModelState.IsValid)
            return View("~/Areas/Game/Views/Home/Mode.cshtml", model);

        var mode = await db.GameModeDefinitions.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (mode is null)
            return NotFound();

        var duplicate = await db.GameModeDefinitions.AnyAsync(item => item.Code == model.Code && item.Id != id, cancellationToken);
        if (duplicate)
        {
            ModelState.AddModelError(nameof(model.Code), "Mini Game 模式代碼已存在。");
            return View("~/Areas/Game/Views/Home/Mode.cshtml", model);
        }

        db.Entry(mode).Property(item => item.RowVersion).OriginalValue = model.RowVersion;
        mode.Code = model.Code;
        mode.Name = model.Name;
        mode.Description = model.Description;
        mode.ConfigJson = model.ConfigJson;
        mode.GradeBThreshold = model.GradeBThreshold;
        mode.GradeAThreshold = model.GradeAThreshold;
        mode.GradeSThreshold = model.GradeSThreshold;
        mode.FailPointReward = model.FailPointReward;
        mode.FailKeyProgressReward = model.FailKeyProgressReward;
        mode.BPointReward = model.BPointReward;
        mode.BKeyProgressReward = model.BKeyProgressReward;
        mode.APointReward = model.APointReward;
        mode.AKeyProgressReward = model.AKeyProgressReward;
        mode.SPointReward = model.SPointReward;
        mode.SKeyProgressReward = model.SKeyProgressReward;
        mode.IsActive = model.IsActive;
        mode.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["SuccessMessage"] = "Mini Game 模式設定已更新。";
            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "Mini Game 模式已被其他管理員修改，請重新載入後再試。");
            return View("~/Areas/Game/Views/Home/Mode.cshtml", model);
        }
    }

    /// <summary>切換 Mini Game 模式是否提供給前端開始新的 Attempt。</summary>
    [HttpPost("Mode/Toggle")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleMode(Guid id, CancellationToken cancellationToken = default)
    {
        var mode = await db.GameModeDefinitions.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (mode is null)
            return NotFound();
        mode.IsActive = !mode.IsActive;
        mode.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = mode.IsActive ? "Mini Game 模式已啟用。" : "Mini Game 模式已停用。";
        return RedirectToAction(nameof(Index));
    }

    private async Task<IActionResult> ReturnIndexWithErrorsAsync(
        GameEconomyEditViewModel model,
        CancellationToken cancellationToken)
    {
        var modes = await db.GameModeDefinitions
            .AsNoTracking()
            .OrderBy(item => item.Code)
            .ToListAsync(cancellationToken);
        return View("~/Areas/Game/Views/Home/Economy.cshtml", new GameEconomyPageViewModel { Economy = model, Modes = modes });
    }

    private void ValidateEconomy(GameEconomyEditViewModel model)
    {
        if (model.MinimumPointReward > model.MaximumPointReward)
            ModelState.AddModelError(nameof(model.MaximumPointReward), "最高點數獎勵不可小於最低點數獎勵。");
        if (model.BasePointReward < model.MinimumPointReward || model.BasePointReward > model.MaximumPointReward)
            ModelState.AddModelError(nameof(model.BasePointReward), "基礎點數獎勵必須落在最低與最高點數之間。");
        if (model.MaximumPointReward < model.BasePointReward + model.MaximumVoteBonus + model.MaximumWinBonus)
            ModelState.AddModelError(nameof(model.MaximumPointReward), "最高點數獎勵應足以涵蓋基礎值與兩種加成上限。");
    }

    private void ValidateMode(GameModeEditViewModel model)
    {
        if (model.GradeAThreshold < model.GradeBThreshold)
            ModelState.AddModelError(nameof(model.GradeAThreshold), "A 級門檻不可低於 B 級門檻。");
        if (model.GradeSThreshold < model.GradeAThreshold)
            ModelState.AddModelError(nameof(model.GradeSThreshold), "S 級門檻不可低於 A 級門檻。");
        if (model.ConfigJson is not null)
        {
            try
            {
                using var document = JsonDocument.Parse(model.ConfigJson);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                    ModelState.AddModelError(nameof(model.ConfigJson), "素材設定必須是 JSON 物件。");
            }
            catch (JsonException)
            {
                ModelState.AddModelError(nameof(model.ConfigJson), "素材設定不是有效的 JSON。");
            }
        }
    }

    private static GameEconomySetting DefaultSetting() => new()
    {
        Id = 1,
        MinimumPointReward = 8,
        MaximumPointReward = 20,
        BasePointReward = 8,
        MaximumVoteBonus = 8,
        MaximumWinBonus = 4,
        CompletedNormalKey = 1,
        ExcellentExtraNormalKey = 1,
        ExcellentThreshold = 80,
        DailyMiniGameRewardLimit = 5,
        KeyProgressToNormalKey = 100
    };
}
