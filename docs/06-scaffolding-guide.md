# Visual Studio Scaffold 操作教學

Scaffold 會根據 Entity 與 `QmahDbContext` 產生 MVC Controller 和 Razor Views，適合快速建立 List、Details、Create、Edit、Delete 的第一版骨架

它不會替專案決定權限、ViewModel、商業規則、外鍵限制、歷史資料保存或畫面風格。產生完成代表「檔案骨架已建立」，不代表功能可以直接交付

## 開始前要準備什麼

1. 從 Release 還原 `QMAH-<version>.bak`，或執行 `database/QMAH.sql`
2. 用 Visual Studio 開啟 `QMAH.sln`
3. 確認啟動專案是 `QMAH.Web`
4. 先執行一次 **Build Solution**，確認沒有錯誤
5. 確認要管理的 Entity 已存在於 `QMAH.Web/Models/Entities`
6. 確認 `QmahDbContext` 有對應的 `DbSet<TEntity>`

專案已安裝 `Microsoft.VisualStudio.Web.CodeGeneration.Design`，一般情況不需要再安裝 NuGet 套件

## 方法一：一次產生 Controller 與 CRUD Views

以下用 `Catalog` 的 `ArtifactCategory` 當例子

1. 在 Solution Explorer 找到 `QMAH.Web/Areas/Catalog/Controllers`
2. 對 `Controllers` 按右鍵
3. 選 **Add** → **New Scaffolded Item...**
4. 選 **MVC Controller with views, using Entity Framework**
5. 按 **Add**
6. Model class 選 `ArtifactCategory`
7. Data context class 選 `QmahDbContext`
8. Controller name 使用 `ArtifactCategoriesController`
9. 勾選 **Generate views**
10. 不勾選建立新的 DbContext
11. 按 **Add**，等待產生完成

Visual Studio 會產生 Controller 與五個 View。依版本與執行位置不同，View 可能出現在根目錄 `Views/ArtifactCategories`，也可能位於 Area。最後必須整理成：

```text
QMAH.Web/Areas/Catalog/
├─ Controllers/ArtifactCategoriesController.cs
└─ Views/ArtifactCategories/
   ├─ Index.cshtml
   ├─ Details.cshtml
   ├─ Create.cshtml
   ├─ Edit.cshtml
   └─ Delete.cshtml
```

若 View 被產生到 `QMAH.Web/Views/ArtifactCategories`，使用 Visual Studio 將整個資料夾移到 `Areas/Catalog/Views/ArtifactCategories`

## 方法二：先建立 Controller，再逐頁新增 View

不需要完整 CRUD 時，可先建立 Controller，再只新增實際使用的 View。

建立 Controller：

1. 對目標 Area 的 `Controllers` 資料夾按右鍵
2. 選 **Add** → **Controller...**
3. 選 **MVC Controller - Empty**
4. 輸入 Controller 名稱
5. 補上正確 namespace、`[Area("...")]`、建構式注入與 Actions

從 Action 新增 View：

1. 在 Controller 的 Action 名稱上按右鍵
2. 選 **Add View...**
3. View name 使用 Action 名稱，例如 `Index`
4. Template 依需求選 `Empty`、`List`、`Details`、`Create`、`Edit` 或 `Delete`
5. Model class 選該頁真正使用的 ViewModel；只有暫時檢查 Scaffold 輸出時才直接選 Entity
6. 確認 View 產生在 `Areas/<Area>/Views/<Controller>/`

這種方式適合只做 List／Details，或 Controller 已經存在、需要逐步加入頁面的情況。

## 方法三：直接在 Views 資料夾新增 Razor View

View 不需要由 Controller 選單產生。也可以在 `Areas/<Area>/Views/<Controller>` 資料夾按右鍵，選 **Add** → **New Item...**，再選：

| 項目 | 用途 |
| --- | --- |
| **Razor View - Empty** | 一般 `.cshtml` 頁面，手動加入 `@model` 與 HTML |
| **Razor View** | 依 Visual Studio 版本選擇範本與 Model |
| **Razor View - Partial** | 共用表單、表格列、狀態區塊等 Partial View |
| **Razor Layout** | 只有確定需要 Area 專用 Layout 時才建立 |

QMAH 使用 ASP.NET Core MVC。新增畫面時要選 **Razor View**，不是 **Razor Page**。Razor Page 會建立 `.cshtml` 與 `.cshtml.cs` PageModel，使用不同的路由與程式模型，不放進目前的 MVC Area CRUD。

手動新增 View 時，檔名必須對應 Action，例如 `Index()` 預設尋找 `Index.cshtml`。View 的第一行以 `@model` 指定 ViewModel：

```cshtml
@model IReadOnlyList<QMAH.Web.Areas.Catalog.ViewModels.ArtifactCategoryListItemViewModel>
```

## 方法四：使用命令列 Scaffold

專案已在 `dotnet-tools.json` 固定 `dotnet-aspnet-codegenerator` 版本。命令列適合批次驗證或 Visual Studio 圖形介面無法使用時，不是一般開發的必要步驟。

先在 Repository 根目錄還原工具：

```powershell
dotnet tool restore
```

產生 Controller 與 Views：

```powershell
dotnet aspnet-codegenerator `
  --project .\QMAH.Web\QMAH.Web.csproj `
  controller `
  --controllerName ArtifactCategoriesController `
  --model QMAH.Web.Models.Entities.ArtifactCategory `
  --dataContext QMAH.Web.Data.QmahDbContext `
  --relativeFolderPath Areas\Catalog\Controllers `
  --useAsyncActions `
  --useDefaultLayout `
  --referenceScriptLibraries
```

不同工具版本對參數短名與 View 輸出位置可能不同，可先執行：

```powershell
dotnet aspnet-codegenerator `
  --project .\QMAH.Web\QMAH.Web.csproj `
  controller --help
```

產生後仍需確認 Views 是否位於正確 Area，並完成後續修正。工具輸出錯誤時不要改用新 DbContext、Migration 或第二套資料庫繞過問題。

## 各種建立方式的選擇

| 需求 | 建立方式 |
| --- | --- |
| 單表需要完整 List、Details、Create、Edit、Delete 骨架 | Controller with views, using Entity Framework |
| 只需要部分 Actions 或既有 Controller 要補畫面 | MVC Controller - Empty，再從 Action 新增 View |
| 已有 Action 與 ViewModel，只缺 `.cshtml` | 在 Views 資料夾新增 Razor View |
| Create 與 Edit 共用欄位 | 新增 Razor Partial View |
| 批次驗證或圖形介面無法使用 | `dotnet-aspnet-codegenerator` |
| Identity 帳號、跨表交易、付款、點數、遊戲結算 | 不使用完整 CRUD Scaffold；依既有 Entity、`QmahDbContext`、ViewModel 與流程規則撰寫 |

## 產生後先修 Area

Controller 必須有正確 namespace 與 `[Area]`

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QMAH.Web.Data;

namespace QMAH.Web.Areas.Catalog.Controllers;

[Area("Catalog")]
public class ArtifactCategoriesController : Controller
{
    private readonly QmahDbContext _db;

    public ArtifactCategoriesController(QmahDbContext db)
    {
        _db = db;
    }
}
```

連結如果位於同一個 Controller，可以只寫 `asp-action`。從其他 Area 或共用導覽連過來時，要明確寫出 Area：

```cshtml
<a asp-area="Catalog"
   asp-controller="ArtifactCategories"
   asp-action="Index">文物分類</a>
```

啟動後先直接輸入 `/Catalog/ArtifactCategories`。若出現 404，依序檢查：

- Controller 是否有 `[Area("Catalog")]`
- Controller namespace 是否在 `QMAH.Web.Areas.Catalog.Controllers`
- View 是否位於 `Areas/Catalog/Views/ArtifactCategories`
- `Program.cs` 是否保留 Area route
- Controller 名稱、View 資料夾名稱與網址是否一致

## 產生後一定要改的地方

### 1. 清單改成唯讀查詢

Scaffold 常直接把整個 Entity List 傳給 View。清單至少加入 `AsNoTracking()`；畫面欄位較少時，再投影成 List ViewModel

```csharp
var categories = await _db.ArtifactCategories
    .AsNoTracking()
    .OrderBy(category => category.Code)
    .ToListAsync(cancellationToken);
```

### 2. POST 改用 ViewModel

Scaffold 為了快速產生範例，可能直接把 Entity 當表單 Model。正式功能請建立 ViewModel，只接收允許使用者修改的欄位

```csharp
public sealed class ArtifactCategoryFormViewModel
{
    [Required]
    [StringLength(32)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    public string Name { get; set; } = string.Empty;
}
```

Edit POST 使用網址 `id` 查回 Entity，再逐欄更新。不要直接相信表單傳回的 Id、UserId、價格、角色、狀態或外鍵

### 3. 補上後端規則

產生器不知道 QMAH 的規則。依資料表檢查：

- 唯一代碼是否重複
- 外鍵指定的資料是否存在
- 目前狀態是否允許修改
- 登入者是否有權操作這筆資料
- 刪除是否會破壞訂單、回合、作答、投票或其他歷史
- 有 `RowVersion` 時是否處理並行更新
- 多張表是否需要同一個交易

### 4. 保留 Anti-forgery 與 ModelState

Scaffold 產生的 POST 通常已包含 `[ValidateAntiForgeryToken]`。專案也已在 `Program.cs` 全域套用 `AutoValidateAntiforgeryTokenAttribute`，保留 Action 上的 Attribute 不會衝突。表單送出後先檢查 `ModelState.IsValid`，失敗時回到原 View 顯示錯誤

### 5. 補授權

期中後台至少要求登入，管理頁再限制 `Admin`：

```csharp
[Authorize(Roles = "Admin")]
[Area("Catalog")]
public class ArtifactCategoriesController : Controller
```

只在 View 隱藏按鈕不算授權，Controller 仍要檢查

## 哪些資料適合 Scaffold

適合先產生骨架：

- 文物分類、年代桶等單表維護
- 商品、公告、活動的基本清單與表單
- Profile、地址等欄位明確的 CRUD

不適合直接把 Scaffold 結果當完成品：

- `AspNetUsers`、`AspNetRoles` 與其他 Identity 表
- 結帳、付款、庫存、點數
- 遊戲回合、結算、獎勵與投票
- 同步文物、題庫、商品上下架
- 任何需要同時更新多張表的流程

Identity 使用 `UserManager`、`SignInManager`、`RoleManager`。跨表流程依責任建立具體 Service，不要用五份單表 Scaffold 拼成一個交易

## 自動產生與手動撰寫的界線

| 內容 | 建議方式 | 原因 |
| --- | --- | --- |
| Solution、MVC 專案基本結構 | Visual Studio／`dotnet new` | 保留官方範本結構 |
| Controller 與基本 Views | Visual Studio Scaffold | 快速產生 CRUD 骨架 |
| Entity 與 DbContext 對照 | EF Core Reverse Engineering 到暫存資料夾 | 以 SQL Server Schema 為準，避免手猜欄位 |
| NuGet 鎖定檔 | NuGet Restore 自動產生 | 不手動修改解析結果 |
| `bin`、`obj`、靜態資產壓縮結果 | Build 自動產生 | 不提交 Repository |
| ViewModel | 依實際頁面手寫 | 產生器不知道畫面允許哪些欄位 |
| 權限、狀態、交易、歷史保存 | 依功能手寫 | 這些是 QMAH 的商業規則 |
| Razor 版面與文字 | 依頁面需求調整 | Scaffold 只提供最低限度 HTML |

QMAH 使用 ASP.NET Core Identity，因此 EF Core Reverse Engineering 產生的 `AspNetUser`、`AspNetRole` POCO 不能直接放進正式專案。正確流程是先輸出到 `_工具輸出` 比對資料表，再保留目前的 `ApplicationUser`、`IdentityRole<Guid>` 與 Identity mapping

## 常見錯誤

### Scaffold 視窗找不到 Entity 或 DbContext

先關閉視窗、Build Solution，再重新開啟。仍找不到時，確認專案已還原 NuGet，Entity 與 DbContext 是 `public`，且啟動專案為 `QMAH.Web`

### 產生時要求新增 Migration

不要執行。QMAH 是 DB-first，資料表已存在。確認選到現有的 `QmahDbContext`，不是讓產生器建立新的 Context

### 頁面可以開，但 POST 沒有更新

檢查：

- `ModelState` 是否失敗
- 是否查回受追蹤 Entity
- 是否逐欄設定新值
- 是否呼叫 `SaveChangesAsync()`
- 是否被唯一索引、外鍵或 CHECK constraint 擋下
- 是否把查詢誤加成 `AsNoTracking()` 後又直接修改該 Entity

### 外鍵欄位只顯示 Guid

Scaffold 不知道適合的顯示名稱。Controller 查詢選項後建立 `SelectList`，View 使用 `asp-items`；清單顯示關聯資料時使用 `Include()` 或直接 `Select()` 成 ViewModel

## 完成後怎麼驗證

1. 測試有資料與空資料的 List
2. 測試搜尋、排序與關聯欄位
3. Create 測試正常值、空白值、重複值
4. Edit 測試不存在 Id、無權限與並行更新
5. Delete 測試有外鍵與歷史資料時能阻止刪除
6. 重新整理 POST 完成後的頁面，確認不會重複送出
7. Build Solution，檢查瀏覽器 Console 與應用程式 Log

一份可直接對照的完整程式在[從清單到完整 CRUD](05-crud-tutorial.md)，DbContext 的查詢與寫入細節在[QmahDbContext 使用手冊](07-dbcontext-usage.md)
