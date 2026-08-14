using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

using QMAH.Web.Areas.Game.ViewModels;
using QMAH.Web.Data;
using QMAH.Web.Infrastructure.AdminNavigation;
using QMAH.Web.Models.Entities;

namespace QMAH.Web.Areas.Game.Controllers;

[Area("Game")]
[AdminNavigation("題庫設定", order: 10)]
public sealed class QuestionEntriesController(QmahDbContext db) : Controller
{
    public async Task<IActionResult> Index(
        string? search,
        bool? isEnabled,
        byte? difficulty,
        string? categoryCode,
        string? sort,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = GameCodeLists.NormalizePageSize(pageSize);
        search = search?.Trim();
        categoryCode = categoryCode?.Trim().ToUpperInvariant();
        difficulty = difficulty is >= 1 and <= 5 ? difficulty : null;
        sort = NormalizeSort(sort);

        var query = db.ArtifactQuestionEntries
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Artifact.Name.Contains(search) ||
                x.Artifact.ArtifactRef.Contains(search));
        }

        if (isEnabled.HasValue)
        {
            query = query.Where(x => x.IsEnabled == isEnabled.Value);
        }

        if (difficulty.HasValue)
        {
            query = query.Where(x => x.Difficulty == difficulty.Value);
        }

        if (!string.IsNullOrWhiteSpace(categoryCode))
        {
            query = query.Where(x => x.Artifact.Category.Code == categoryCode);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        page = Math.Min(page, totalPages);

        query = sort switch
        {
            "difficulty" => query.OrderByDescending(x => x.Difficulty).ThenBy(x => x.Artifact.Name),
            "enabled" => query.OrderByDescending(x => x.IsEnabled).ThenBy(x => x.Artifact.Name),
            "updated" => query.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Artifact.Name),
            _ => query.OrderBy(x => x.Artifact.Category.Name).ThenBy(x => x.Artifact.Name)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new QuestionEntryListItemViewModel
            {
                Id = x.Id,
                ArtifactRef = x.Artifact.ArtifactRef,
                ArtifactName = x.Artifact.Name,
                CategoryName = x.Artifact.Category.Name,
                EraName = x.Artifact.EraBucket.Name,
                IsEnabled = x.IsEnabled,
                Difficulty = x.Difficulty,
                QuestionTemplateCode = x.QuestionTemplateCode,
                UpdatedAt = x.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        ViewBag.Categories = new SelectList(
            await db.ArtifactCategories
                .AsNoTracking()
                .OrderBy(x => x.Name)
                .ToListAsync(cancellationToken),
            "Code",
            "Name",
            categoryCode);

        return View(new QuestionEntryIndexViewModel
        {
            Search = search,
            IsEnabled = isEnabled,
            Difficulty = difficulty,
            CategoryCode = categoryCode,
            Sort = sort,
            PageSize = pageSize,
            Results = new PagedResult<QuestionEntryListItemViewModel>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            }
        });
    }

    public async Task<IActionResult> Details(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.ArtifactQuestionEntries
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new QuestionEntryDetailsViewModel
            {
                Id = x.Id,
                ArtifactRef = x.Artifact.ArtifactRef,
                ArtifactName = x.Artifact.Name,
                CategoryName = x.Artifact.Category.Name,
                EraName = x.Artifact.EraBucket.Name,
                ImagePath = x.Artifact.ThumbnailPath ?? x.Artifact.PrimaryImagePath,
                IsEnabled = x.IsEnabled,
                Difficulty = x.Difficulty,
                QuestionTemplateCode = x.QuestionTemplateCode,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    public async Task<IActionResult> Create(CancellationToken cancellationToken)
    {
        await LoadCreateOptionsAsync(null, cancellationToken);
        return View(new QuestionEntryCreateViewModel());
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        QuestionEntryCreateViewModel model,
        CancellationToken cancellationToken)
    {
        model.QuestionTemplateCode = (model.QuestionTemplateCode ?? string.Empty).Trim().ToUpperInvariant();

        if (!GameCodeLists.QuestionTemplates.ContainsKey(model.QuestionTemplateCode))
        {
            ModelState.AddModelError(nameof(model.QuestionTemplateCode), "題型範本不正確");
        }

        if (!model.ArtifactId.HasValue)
        {
            ModelState.AddModelError(nameof(model.ArtifactId), "請選擇尚未建立題庫設定的文物");
        }
        else
        {
            var artifact = await db.Artifacts
                .AsNoTracking()
                .Where(x => x.Id == model.ArtifactId.Value)
                .Select(x => new { x.IsActive, HasEntry = x.ArtifactQuestionEntry != null })
                .SingleOrDefaultAsync(cancellationToken);

            if (artifact is null)
            {
                ModelState.AddModelError(nameof(model.ArtifactId), "文物不存在");
            }
            else if (!artifact.IsActive)
            {
                ModelState.AddModelError(nameof(model.ArtifactId), "停用中的文物不能加入題庫");
            }
            else if (artifact.HasEntry)
            {
                ModelState.AddModelError(nameof(model.ArtifactId), "這件文物已有題庫設定");
            }
        }

        if (!ModelState.IsValid)
        {
            await LoadCreateOptionsAsync(model.ArtifactId, cancellationToken);
            return View(model);
        }

        var now = DateTime.UtcNow;
        db.ArtifactQuestionEntries.Add(new ArtifactQuestionEntry
        {
            Id = Guid.NewGuid(),
            ArtifactId = model.ArtifactId!.Value,
            IsEnabled = model.IsEnabled,
            Difficulty = model.Difficulty,
            QuestionTemplateCode = model.QuestionTemplateCode,
            CreatedAt = now,
            UpdatedAt = now
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "題庫設定已建立。";
            return RedirectToAction(nameof(Index));
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請確認文物是否仍可建立題庫設定。");
            await LoadCreateOptionsAsync(model.ArtifactId, cancellationToken);
            return View(model);
        }
    }

    public async Task<IActionResult> Edit(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.ArtifactQuestionEntries
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new QuestionEntryEditViewModel
            {
                Id = x.Id,
                ArtifactId = x.ArtifactId,
                ArtifactRef = x.Artifact.ArtifactRef,
                ArtifactName = x.Artifact.Name,
                IsEnabled = x.IsEnabled,
                Difficulty = x.Difficulty,
                QuestionTemplateCode = x.QuestionTemplateCode
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Edit(
        Guid id,
        QuestionEntryEditViewModel model,
        CancellationToken cancellationToken)
    {
        if (id != model.Id)
        {
            return NotFound();
        }

        model.QuestionTemplateCode = (model.QuestionTemplateCode ?? string.Empty).Trim().ToUpperInvariant();

        if (!GameCodeLists.QuestionTemplates.ContainsKey(model.QuestionTemplateCode))
        {
            ModelState.AddModelError(nameof(model.QuestionTemplateCode), "題型範本不正確");
        }

        var entity = await db.ArtifactQuestionEntries
            .Include(x => x.Artifact)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound();
        }

        model.ArtifactId = entity.ArtifactId;
        model.ArtifactRef = entity.Artifact.ArtifactRef;
        model.ArtifactName = entity.Artifact.Name;

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        entity.IsEnabled = model.IsEnabled;
        entity.Difficulty = model.Difficulty;
        entity.QuestionTemplateCode = model.QuestionTemplateCode;
        entity.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "題庫設定已更新。";
            return RedirectToAction(nameof(Details), new { id });
        }
        catch (DbUpdateException)
        {
            ModelState.AddModelError(string.Empty, "資料未能儲存，請重新確認輸入內容。");
            return View(model);
        }
    }

    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var model = await db.ArtifactQuestionEntries
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new QuestionEntryDeleteViewModel
            {
                Id = x.Id,
                ArtifactRef = x.Artifact.ArtifactRef,
                ArtifactName = x.Artifact.Name,
                IsEnabled = x.IsEnabled
            })
            .SingleOrDefaultAsync(cancellationToken);

        return model is null ? NotFound() : View(model);
    }

    [HttpPost, ActionName("Delete")]
    public async Task<IActionResult> DeleteConfirmed(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.ArtifactQuestionEntries.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return RedirectToAction(nameof(Index));
        }

        db.ArtifactQuestionEntries.Remove(entity);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            TempData["Success"] = "題庫設定已刪除。";
        }
        catch (DbUpdateException)
        {
            TempData["Error"] = "題庫設定目前無法刪除，請確認文物關聯仍然有效。";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task LoadCreateOptionsAsync(Guid? selected, CancellationToken cancellationToken)
    {
        var artifacts = await db.Artifacts
            .AsNoTracking()
            .Where(x => x.IsActive && x.ArtifactQuestionEntry == null)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                Label = x.Name + "（" + x.ArtifactRef + "）"
            })
            .ToListAsync(cancellationToken);

        ViewBag.Artifacts = new SelectList(artifacts, "Id", "Label", selected);
    }

    private static string NormalizeSort(string? sort) => sort?.Trim().ToLowerInvariant() switch
    {
        "difficulty" or "enabled" or "updated" => sort.Trim().ToLowerInvariant(),
        _ => "artifact"
    };
}
