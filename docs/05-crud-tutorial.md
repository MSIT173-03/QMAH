# 從清單到完整 CRUD

這份教學使用專案現有的 `catalog.ArtifactCategories` 示範後台開發。完成後可在 `/Catalog/ArtifactCategory` 查看分類清單、搜尋、詳細資料、新增、編輯與刪除未被使用的測試分類

`ArtifactCategory` 只有 `Id`、`Code`、`Name`，適合先學完整流程。現有 8 個正式分類已被文物或鑰匙使用，不能刪除；練習刪除時，請先新增一筆沒有關聯的測試分類

## 先看最基礎的資料清單

一個可用的 List 頁面只需要三個部分：

```text
網址
  → Controller 的 Index Action
  → QmahDbContext 查詢資料
  → List ViewModel
  → Index.cshtml 顯示表格
```

先建立以下資料夾與檔案：

```text
QMAH.Web/Areas/Catalog/
├─ Controllers/ArtifactCategoryController.cs
├─ ViewModel/ArtifactCategoryViewModels.cs
└─ Views/ArtifactCategory/
   └─ Index.cshtml
```

### 1. 建立清單 ViewModel

`Areas/Catalog/ViewModel/ArtifactCategoryViewModels.cs`

```csharp
using System.ComponentModel.DataAnnotations;

namespace QMAH.Web.Areas.Catalog.ViewModel;

public sealed class ArtifactCategoryListItemViewModel
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int ArtifactCount { get; init; }
}

public sealed class ArtifactCategoryDetailsViewModel
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int ArtifactCount { get; init; }
    public int KeyDefinitionCount { get; init; }

    public bool CanDelete => ArtifactCount == 0 && KeyDefinitionCount == 0;
}

public sealed class ArtifactCategoryFormViewModel
{
    [Required(ErrorMessage = "請輸入分類代碼")]
    [StringLength(32, ErrorMessage = "分類代碼最多 32 個字元")]
    [RegularExpression("^[A-Za-z0-9_]+$", ErrorMessage = "分類代碼只能使用英文字母、數字與底線")]
    [Display(Name = "分類代碼")]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入分類名稱")]
    [StringLength(80, ErrorMessage = "分類名稱最多 80 個字元")]
    [Display(Name = "分類名稱")]
    public string Name { get; set; } = string.Empty;
}
```

Entity 對應資料表，ViewModel 對應畫面。清單只需要 4 個欄位，不必把完整 Entity 與導覽屬性送進 View

### 2. 建立 Controller 與 Index

`Areas/Catalog/Controllers/ArtifactCategoryController.cs`

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Web.Areas.Catalog.ViewModel;
using QMAH.Infrastructure.Data;
using QMAH.Infrastructure.Models.Entities;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
public sealed class ArtifactCategoryController : Controller
{
    private readonly QmahDbContext _db;

    public ArtifactCategoryController(QmahDbContext db)
    {
        _db = db;
    }

    public async Task<IActionResult> Index(
        string? keyword,
        CancellationToken cancellationToken)
    {
        var query = _db.ArtifactCategories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(category =>
                category.Code.Contains(term) ||
                category.Name.Contains(term));
        }

        var items = await query
            .OrderBy(category => category.Code)
            .Select(category => new ArtifactCategoryListItemViewModel
            {
                Id = category.Id,
                Code = category.Code,
                Name = category.Name,
                ArtifactCount = category.Artifacts.Count
            })
            .ToListAsync(cancellationToken);

        ViewData["Keyword"] = keyword;
        return View(items);
    }
}
```

這段查詢的重點：

- `AsNoTracking()`：清單不修改 Entity，不需要追蹤
- `Where()`：有關鍵字時才加入篩選
- `OrderBy()`：排序要在資料庫查詢完成前設定
- `Select()`：只取畫面需要的欄位
- `ToListAsync()`：到這一行才真正向 SQL Server 查詢
- `CancellationToken`：使用者中止 request 時，EF Core 可以停止等待

### 3. 建立 Index View

`Areas/Catalog/Views/ArtifactCategory/Index.cshtml`

```cshtml
@model IReadOnlyList<QMAH.Web.Areas.Catalog.ViewModel.ArtifactCategoryListItemViewModel>

@{
    ViewData["Title"] = "文物分類管理";
    var keyword = ViewData["Keyword"] as string;
}

<div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
    <div>
        <h1 class="h3 mb-1">文物分類管理</h1>
        <p class="text-secondary mb-0">管理分類代碼與顯示名稱</p>
    </div>
    <a class="btn btn-primary"
       asp-area="Catalog"
       asp-controller="ArtifactCategory"
       asp-action="Create">新增分類</a>
</div>

<form method="get" class="row g-2 mb-3">
    <div class="col-sm-8 col-lg-5">
        <label for="keyword" class="visually-hidden">搜尋分類</label>
        <input id="keyword"
               name="keyword"
               value="@keyword"
               class="form-control"
               placeholder="搜尋代碼或名稱" />
    </div>
    <div class="col-auto">
        <button type="submit" class="btn btn-outline-primary">搜尋</button>
        <a class="btn btn-outline-secondary"
           asp-action="Index">清除</a>
    </div>
</form>

@if (Model.Count == 0)
{
    <div class="alert alert-light border" role="status">
        找不到符合條件的分類
    </div>
}
else
{
    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead>
                <tr>
                    <th scope="col">代碼</th>
                    <th scope="col">名稱</th>
                    <th scope="col" class="text-end">文物數量</th>
                    <th scope="col" class="text-end">操作</th>
                </tr>
            </thead>
            <tbody>
                @foreach (var item in Model)
                {
                    <tr>
                        <td><code>@item.Code</code></td>
                        <td>@item.Name</td>
                        <td class="text-end">@item.ArtifactCount</td>
                        <td class="text-end text-nowrap">
                            <a class="btn btn-sm btn-outline-secondary"
                               asp-action="Details"
                               asp-route-id="@item.Id">查看</a>
                            <a class="btn btn-sm btn-outline-primary"
                               asp-action="Edit"
                               asp-route-id="@item.Id">編輯</a>
                        </td>
                    </tr>
                }
            </tbody>
        </table>
    </div>
}
```

先啟動網站並開啟 `/Catalog/ArtifactCategory`。能看到 8 個分類，就代表 Area 路由、Controller、DbContext、查詢、ViewModel 與 Razor View 已經接通

## 補上 Details、Create、Edit、Delete

確認 List 正常後，再把以下 Actions 加進同一個 Controller

### Details

```csharp
public async Task<IActionResult> Details(
    Guid id,
    CancellationToken cancellationToken)
{
    var item = await _db.ArtifactCategories
        .AsNoTracking()
        .Where(category => category.Id == id)
        .Select(category => new ArtifactCategoryDetailsViewModel
        {
            Id = category.Id,
            Code = category.Code,
            Name = category.Name,
            ArtifactCount = category.Artifacts.Count,
            KeyDefinitionCount = category.KeyDefinitions.Count
        })
        .SingleOrDefaultAsync(cancellationToken);

    return item is null ? NotFound() : View(item);
}
```

不要先 `FindAsync()`，再到 View 裡查文物數量。這裡直接投影成 Details ViewModel，一次取得畫面需要的資料

### Create

```csharp
[HttpGet]
public IActionResult Create()
{
    return View(new ArtifactCategoryFormViewModel());
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create(
    ArtifactCategoryFormViewModel input,
    CancellationToken cancellationToken)
{
    if (!ModelState.IsValid)
    {
        return View(input);
    }

    var code = input.Code.Trim().ToUpperInvariant();
    var name = input.Name.Trim();

    var codeExists = await _db.ArtifactCategories
        .AnyAsync(category => category.Code == code, cancellationToken);

    if (codeExists)
    {
        ModelState.AddModelError(nameof(input.Code), "分類代碼已存在");
        return View(input);
    }

    _db.ArtifactCategories.Add(new ArtifactCategory
    {
        Id = Guid.NewGuid(),
        Code = code,
        Name = name
    });

    await _db.SaveChangesAsync(cancellationToken);
    TempData["SuccessMessage"] = "分類已新增";

    return RedirectToAction(nameof(Index));
}
```

GET 顯示空白表單，POST 接收表單。POST 成功後重新導向 Index，避免重新整理時重複新增

### Edit

```csharp
[HttpGet]
public async Task<IActionResult> Edit(
    Guid id,
    CancellationToken cancellationToken)
{
    var input = await _db.ArtifactCategories
        .AsNoTracking()
        .Where(category => category.Id == id)
        .Select(category => new ArtifactCategoryFormViewModel
        {
            Code = category.Code,
            Name = category.Name
        })
        .SingleOrDefaultAsync(cancellationToken);

    return input is null ? NotFound() : View(input);
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Edit(
    Guid id,
    ArtifactCategoryFormViewModel input,
    CancellationToken cancellationToken)
{
    if (!ModelState.IsValid)
    {
        return View(input);
    }

    var category = await _db.ArtifactCategories
        .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

    if (category is null)
    {
        return NotFound();
    }

    var code = input.Code.Trim().ToUpperInvariant();
    var codeExists = await _db.ArtifactCategories.AnyAsync(
        other => other.Id != id && other.Code == code,
        cancellationToken);

    if (codeExists)
    {
        ModelState.AddModelError(nameof(input.Code), "分類代碼已存在");
        return View(input);
    }

    category.Code = code;
    category.Name = input.Name.Trim();

    await _db.SaveChangesAsync(cancellationToken);
    TempData["SuccessMessage"] = "分類已更新";

    return RedirectToAction(nameof(Details), new { id });
}
```

Edit POST 先用網址的 `id` 查回受追蹤 Entity，再逐欄更新。不要直接把表單綁成 Entity，也不要呼叫 `_db.Update(input)`

### Delete

```csharp
[HttpGet]
public async Task<IActionResult> Delete(
    Guid id,
    CancellationToken cancellationToken)
{
    var item = await _db.ArtifactCategories
        .AsNoTracking()
        .Where(category => category.Id == id)
        .Select(category => new ArtifactCategoryDetailsViewModel
        {
            Id = category.Id,
            Code = category.Code,
            Name = category.Name,
            ArtifactCount = category.Artifacts.Count,
            KeyDefinitionCount = category.KeyDefinitions.Count
        })
        .SingleOrDefaultAsync(cancellationToken);

    return item is null ? NotFound() : View(item);
}

[HttpPost, ActionName("Delete")]
[ValidateAntiForgeryToken]
public async Task<IActionResult> DeleteConfirmed(
    Guid id,
    CancellationToken cancellationToken)
{
    var category = await _db.ArtifactCategories
        .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

    if (category is null)
    {
        return NotFound();
    }

    var isInUse = await _db.Artifacts
        .AnyAsync(artifact => artifact.CategoryId == id, cancellationToken)
        || await _db.KeyDefinitions
            .AnyAsync(key => key.CategoryId == id, cancellationToken);

    if (isInUse)
    {
        TempData["ErrorMessage"] = "這個分類仍被文物或鑰匙使用，不能刪除";
        return RedirectToAction(nameof(Details), new { id });
    }

    _db.ArtifactCategories.Remove(category);
    await _db.SaveChangesAsync(cancellationToken);
    TempData["SuccessMessage"] = "分類已刪除";

    return RedirectToAction(nameof(Index));
}
```

Delete GET 只顯示確認頁，真正刪除必須使用 POST。既有分類有外鍵關聯，所以後端會阻止刪除；不能只靠畫面隱藏按鈕

## 共用表單 View

Create 與 Edit 欄位相同，可使用 Partial 避免複製兩份 HTML

`Areas/Catalog/Views/ArtifactCategory/_Form.cshtml`

```cshtml
@model QMAH.Web.Areas.Catalog.ViewModel.ArtifactCategoryFormViewModel

<div asp-validation-summary="ModelOnly" class="text-danger mb-3"></div>

<div class="mb-3">
    <label asp-for="Code" class="form-label"></label>
    <input asp-for="Code" class="form-control" autocomplete="off" />
    <span asp-validation-for="Code" class="text-danger"></span>
</div>

<div class="mb-3">
    <label asp-for="Name" class="form-label"></label>
    <input asp-for="Name" class="form-control" autocomplete="off" />
    <span asp-validation-for="Name" class="text-danger"></span>
</div>
```

`Create.cshtml`

```cshtml
@model QMAH.Web.Areas.Catalog.ViewModel.ArtifactCategoryFormViewModel

@{ ViewData["Title"] = "新增文物分類"; }

<h1 class="h3 mb-4">新增文物分類</h1>

<form asp-action="Create" method="post" class="col-lg-6">
    <partial name="_Form" model="Model" />
    <button type="submit" class="btn btn-primary">儲存</button>
    <a asp-action="Index" class="btn btn-outline-secondary">取消</a>
</form>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

`Edit.cshtml`

```cshtml
@model QMAH.Web.Areas.Catalog.ViewModel.ArtifactCategoryFormViewModel

@{ ViewData["Title"] = "編輯文物分類"; }

<h1 class="h3 mb-4">編輯文物分類</h1>

<form asp-action="Edit" method="post" class="col-lg-6">
    <partial name="_Form" model="Model" />
    <button type="submit" class="btn btn-primary">儲存變更</button>
    <a asp-action="Index" class="btn btn-outline-secondary">取消</a>
</form>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

Form Tag Helper 會自動產生 Anti-forgery token。`asp-for` 會把欄位名稱、目前值與驗證資訊接到 ViewModel，`asp-validation-for` 顯示該欄位的錯誤訊息

`Program.cs` 已對所有非 GET MVC Action 啟用全域 Anti-forgery 驗證。範例保留 `[ValidateAntiForgeryToken]`，可直接看出該 Action 的安全需求，與全域設定不衝突

Details 與 Delete View 只需要使用 `ArtifactCategoryDetailsViewModel` 顯示欄位。Delete 的 `<form>` 必須使用 `method="post"`、`asp-action="Delete"` 與 `asp-route-id="@Model.Id"`

## 最快的開發方式

### 只想先確認資料能不能列出來

先做 ViewModel、Index Action、Index View 三個檔案。網址能顯示資料後，再做 Details 與表單，不必一開始就寫完全部 CRUD

### 使用 Visual Studio Scaffold

單表 CRUD 可先讓 Visual Studio 產生骨架：

1. 在 Area 的 `Controllers` 資料夾按右鍵
2. 選 **新增** → **新增 Scaffold 項目**
3. 選 **MVC Controller with views, using Entity Framework**
4. Model 選需要的 Entity
5. Data context 選 `QmahDbContext`
6. 產生到自己的 Area 後，再修正 `[Area]`、namespace、View 路徑與表單欄位

Scaffold 能省下 Controller 與 View 的基本骨架，但產生後仍要：

- 把畫面輸入改成 ViewModel，避免 overposting
- 清單補 `AsNoTracking()`、搜尋、排序與必要的 `Select()`
- 確認 Area 路由與所有連結都有正確 `asp-area`
- POST 補外鍵、唯一值、權限、狀態與商業規則
- 有 `RowVersion` 的 Entity 補並行更新處理
- 不直接 Scaffold 或修改 Identity 資料表

### 使用專案已準備的功能

| 功能 | 可以省下什麼 |
| --- | --- |
| Visual Studio Scaffold | 產生基本 Controller 與 Razor View |
| Hot Reload | 調整 Razor、CSS、JavaScript 時，不必一直重啟網站 |
| Bootstrap | 直接使用表格、表單、按鈕、提示與響應式排版類別 |
| MVC Tag Helpers | 自動產生 Area 連結、表單欄位、驗證訊息與 Anti-forgery token |
| `_ValidationScriptsPartial` | 啟用 jQuery unobtrusive 前端驗證 |
| `QmahDbContext` 導覽屬性 | 使用 `Include()` 或 `Select()` 取得外鍵關聯，不用手動 Join 字串 |
| `TempData` | POST 重新導向後顯示一次性的成功或錯誤訊息 |
| Visual Studio Rename／Extract Method | 安全修改類別名稱與整理過長程式碼 |
| EF Core Power Tools（選用） | 用圖形介面檢查資料庫 Reverse Engineer 結果，不直接覆蓋正式程式 |

Bootstrap 與套件已經放在專案內，不需要各 Area 再安裝一份。共用 Layout、CSS 或 JavaScript 要改時，先確認是否會影響其他模組

## 實際測試順序

1. 開啟清單，確認現有 8 筆分類可顯示
2. 搜尋 `JADE`，確認只留下玉器
3. 使用空白名稱送出新增表單，確認畫面顯示驗證錯誤
4. 新增 `TEST_CATEGORY`／`測試分類`
5. 再新增相同代碼，確認後端拒絕重複值
6. 編輯測試分類，確認更新後重新導向 Details
7. 刪除測試分類，確認清單不再出現
8. 嘗試刪除 `JADE`，確認後端因外鍵關聯阻止刪除
9. 重新整理 POST 完成後的頁面，確認不會重複新增或刪除
10. Build 專案並檢查瀏覽器 Console

## 什麼時候不能直接照這個範例

- Entity 有 `RowVersion`：Edit 必須加入並行衝突處理
- 付款、訂單、點數、庫存、遊戲結算：通常是跨表交易，不能當單表 CRUD
- Identity 帳號、密碼、角色：使用 `UserManager`、`SignInManager`、`RoleManager`
- 已成交訂單、付款、遊戲回合、作答、投票：保留歷史，不做一般實體刪除
- 上傳圖片：ViewModel 使用 `IFormFile`，實際檔案與資料庫欄位分開驗證

專案內更完整的查詢、關聯、交易、`RowVersion` 與 Identity 寫法請看[QmahDbContext 使用手冊](07-dbcontext-usage.md)

## Microsoft 官方教學

- [Get started with ASP.NET Core MVC](https://learn.microsoft.com/aspnet/core/tutorials/first-mvc-app/start-mvc?view=aspnetcore-10.0)
- [ASP.NET Core MVC with EF Core tutorial series](https://learn.microsoft.com/aspnet/core/data/ef-mvc/?view=aspnetcore-10.0)
- [Model validation in ASP.NET Core MVC](https://learn.microsoft.com/aspnet/core/mvc/models/validation?view=aspnetcore-10.0)
- [Tag Helpers in ASP.NET Core](https://learn.microsoft.com/aspnet/core/mvc/views/tag-helpers/intro?view=aspnetcore-10.0)
