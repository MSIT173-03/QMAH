using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;
using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Web.Infrastructure.AdminNavigation;

namespace QMAH.Web.Areas.Catalog.Controllers;

/// <summary>維護由資料庫驅動的鑰匙兌換規則。</summary>
[Area("Catalog")]
[Authorize(Roles = "Admin")]
[Route("catalog/key-exchange")]
[AdminNavigation("鑰匙兌換", 25)]
public sealed class KeyExchangeController(QmahDbContext db) : Controller
{
    /// <summary>列出來源、目標、比例與目前啟用狀態。</summary>
    [HttpGet("")]
    [HttpGet("Index")]
    public async Task<IActionResult> Index(CancellationToken cancellationToken = default)
    {
        var rules = await db.KeyExchangeRules
            .AsNoTracking()
            .Include(rule => rule.SourceKeyDefinition)
            .Include(rule => rule.TargetKeyDefinition)
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.SourceKeyDefinition.Code)
            .ThenBy(rule => rule.TargetKeyDefinition.Code)
            .ToListAsync(cancellationToken);
        return View(rules);
    }

    /// <summary>顯示新增兌換規則表單。</summary>
    [HttpGet("Create")]
    public async Task<IActionResult> Create(CancellationToken cancellationToken = default)
    {
        await PopulateKeyDefinitionsAsync(cancellationToken);
        return View("Edit", new KeyExchangeEditViewModel());
    }

    /// <summary>建立一條新的鑰匙兌換規則。</summary>
    [HttpPost("Create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(
        KeyExchangeEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        Normalize(model);
        await ValidateModelAsync(model, null, cancellationToken);
        if (!ModelState.IsValid)
        {
            await PopulateKeyDefinitionsAsync(cancellationToken);
            return View("Edit", model);
        }

        var now = DateTime.UtcNow;
        db.KeyExchangeRules.Add(new KeyExchangeRule
        {
            Id = Guid.NewGuid(),
            SourceKeyDefinitionId = model.SourceKeyDefinitionId,
            SourceAmount = model.SourceAmount,
            TargetKeyDefinitionId = model.TargetKeyDefinitionId,
            TargetAmount = model.TargetAmount,
            SortOrder = model.SortOrder,
            Description = model.Description,
            IsActive = model.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = "鑰匙兌換規則已建立。";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>顯示既有兌換規則的編輯表單。</summary>
    [HttpGet("Edit/{id:guid}")]
    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken = default)
    {
        var rule = await db.KeyExchangeRules
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (rule is null)
            return NotFound();

        await PopulateKeyDefinitionsAsync(cancellationToken);
        return View(ToViewModel(rule));
    }

    /// <summary>更新兌換比例，並以 RowVersion 避免覆蓋其他管理員的修改。</summary>
    [HttpPost("Edit/{id:guid}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(
        Guid id,
        KeyExchangeEditViewModel model,
        CancellationToken cancellationToken = default)
    {
        if (id != model.Id)
            return BadRequest();

        Normalize(model);
        await ValidateModelAsync(model, id, cancellationToken);
        if (!ModelState.IsValid)
        {
            await PopulateKeyDefinitionsAsync(cancellationToken);
            return View(model);
        }

        var rule = await db.KeyExchangeRules.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (rule is null)
            return NotFound();

        db.Entry(rule).Property(item => item.RowVersion).OriginalValue = model.RowVersion;
        rule.SourceKeyDefinitionId = model.SourceKeyDefinitionId;
        rule.SourceAmount = model.SourceAmount;
        rule.TargetKeyDefinitionId = model.TargetKeyDefinitionId;
        rule.TargetAmount = model.TargetAmount;
        rule.SortOrder = model.SortOrder;
        rule.Description = model.Description;
        rule.IsActive = model.IsActive;
        rule.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(string.Empty, "這條兌換規則已被其他管理員修改，請重新載入後再試。");
            await PopulateKeyDefinitionsAsync(cancellationToken);
            return View(model);
        }

        TempData["SuccessMessage"] = "鑰匙兌換規則已更新。";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>切換規則啟用狀態；停用只停止新兌換，不刪除既有流水。</summary>
    [HttpPost("ToggleActive")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken cancellationToken = default)
    {
        var rule = await db.KeyExchangeRules.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (rule is null)
            return NotFound();

        rule.IsActive = !rule.IsActive;
        rule.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        TempData["SuccessMessage"] = rule.IsActive ? "鑰匙兌換規則已啟用。" : "鑰匙兌換規則已停用。";
        return RedirectToAction(nameof(Index));
    }

    private async Task ValidateModelAsync(
        KeyExchangeEditViewModel model,
        Guid? editingId,
        CancellationToken cancellationToken)
    {
        if (model.SourceKeyDefinitionId == model.TargetKeyDefinitionId)
            ModelState.AddModelError(string.Empty, "來源與目標鑰匙不可相同。");

        var keys = await db.KeyDefinitions
            .AsNoTracking()
            .Where(key => key.Id == model.SourceKeyDefinitionId || key.Id == model.TargetKeyDefinitionId)
            .ToDictionaryAsync(key => key.Id, cancellationToken);
        if (!keys.TryGetValue(model.SourceKeyDefinitionId, out var source))
            ModelState.AddModelError(nameof(model.SourceKeyDefinitionId), "找不到來源鑰匙。");
        if (!keys.TryGetValue(model.TargetKeyDefinitionId, out var target))
            ModelState.AddModelError(nameof(model.TargetKeyDefinitionId), "找不到目標鑰匙。");

        if (source is null || target is null)
            return;
        if (!source.IsActive || !target.IsActive)
            ModelState.AddModelError(string.Empty, "兌換規則只能使用啟用中的鑰匙。");
        if (source.ScopeType != "NORMAL")
            ModelState.AddModelError(nameof(model.SourceKeyDefinitionId), "目前兌換來源應為 NORMAL 一般鑰匙。");
        if (target.ScopeType == "NORMAL")
            ModelState.AddModelError(nameof(model.TargetKeyDefinitionId), "目標應為 CATEGORY、ERA 或 UNIVERSAL 鑰匙。");

        // 以回收點數價值作為最低限度的反套利護欄，避免兌換後再回收反而增加資產。
        var sourceValue = (long)model.SourceAmount * source.RecyclePointValue;
        var targetValue = (long)model.TargetAmount * target.RecyclePointValue;
        if (targetValue > sourceValue)
            ModelState.AddModelError(string.Empty, "這個比例可能造成兌換後回收點數套利，請降低目標數量或先調整回收點數。");

        var duplicate = await db.KeyExchangeRules.AnyAsync(rule =>
            rule.SourceKeyDefinitionId == model.SourceKeyDefinitionId
            && rule.TargetKeyDefinitionId == model.TargetKeyDefinitionId
            && (!editingId.HasValue || rule.Id != editingId.Value), cancellationToken);
        if (duplicate)
            ModelState.AddModelError(string.Empty, "相同來源與目標的兌換規則已存在。");
    }

    private async Task PopulateKeyDefinitionsAsync(CancellationToken cancellationToken)
    {
        // 編輯舊規則時也要顯示已停用的定義，才能讓管理員看見原值；儲存時仍會拒絕以停用鑰匙建立或更新規則。
        ViewBag.KeyDefinitions = await db.KeyDefinitions
            .AsNoTracking()
            .OrderBy(key => key.ScopeType)
            .ThenBy(key => key.Code)
            .ToListAsync(cancellationToken);
    }

    private static void Normalize(KeyExchangeEditViewModel model)
    {
        model.Description = string.IsNullOrWhiteSpace(model.Description) ? null : model.Description.Trim();
    }

    private static KeyExchangeEditViewModel ToViewModel(KeyExchangeRule rule) => new()
    {
        Id = rule.Id,
        SourceKeyDefinitionId = rule.SourceKeyDefinitionId,
        SourceAmount = rule.SourceAmount,
        TargetKeyDefinitionId = rule.TargetKeyDefinitionId,
        TargetAmount = rule.TargetAmount,
        SortOrder = rule.SortOrder,
        Description = rule.Description,
        IsActive = rule.IsActive,
        RowVersion = rule.RowVersion
    };
}
