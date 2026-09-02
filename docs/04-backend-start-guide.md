# Razor 前端管理後台開發起點

管理後台功能從這裡開始。依序確認資料表、路由、ViewModel、授權與 CRUD，再依自己的 Area 延伸。Razor 前端管理後台位於 `QMAH.Web`；Angular 前端使用者前台使用的 JSON 契約位於獨立的 `QMAH.Api`，兩者共用 `QMAH.Infrastructure`。

若還不熟悉 List、Controller、ViewModel、Razor 表單與完整 CRUD 的連接方式，先照[從清單到完整 CRUD](05-crud-tutorial.md)做一次，再回來依自己的資料表調整。

開始各 Area 前，先閱讀[五個 Area 開發前檢查與執行界線](03-area-development-checklist.md)，確認哪些事情要先做、哪些資料不能直接刪除，以及各 Area 的跨表責任

## 開始前

1. 還原最新 Release 附帶的 `QMAH-<version>.bak`，或完整執行 `database/QMAH.sql`。
2. 開啟 `QMAH.sln`，確認 `QMAH.Web` 與 `QMAH.Api` 至少各自可以啟動；Visual Studio 也可以選 `QMAH 後端主機與管理後台（API＋Razor）` 一次啟動兩者。
3. 切到自己負責的 `feature/*` 分支並先 Pull。
4. 先閱讀 `QMAH.Infrastructure/Data/QmahDbContext.cs` 中本 Area 的 DbSet 與 mapping；遠端版本更新後，依 [`database/README.md`](../database/README.md) 用最新版完整快照重新建立資料庫，不直接修改舊資料庫，也不需要自行增量匯入。
5. 用 SSMS Diagram 確認主鍵、外鍵、唯一索引、可否為 `NULL` 與 `rowversion`。

資料庫已存在，不需要建表或建立 Migration。

Identity 的資料表、服務註冊、MVC 登入／登出頁、角色授權與後台 `[Authorize]` 已整合完成。新增或修改後台功能時，仍必須沿用共同授權規則；API 則使用自己的 Cookie 驗證與 HTTP 狀態碼，不把 Razor ViewModel 當成 API 契約。

正式 Repository 保留共同基礎與各 Area 的既有功能。各 Area 依 `QMAH.Infrastructure` 的 Entity 與 `QmahDbContext` 建立功能；Visual Studio Scaffold 用於產生起始碼，產生後仍需完成 ViewModel、授權、驗證與流程調整。需要跨主機共用的文物匯入規則已集中在 Infrastructure，避免 Web 與 API 各自維護一份。

## 檔案放置位置

以 Catalog 的文物管理為例。資料夾可以先建立，ViewModel 則在第一個頁面真的需要時再新增：

```text
QMAH.Web/Areas/Catalog/
├─ Controllers/ArtifactController.cs
├─ ViewModel/ArtifactEditViewModel.cs
└─ Views/Artifact/
   ├─ Index.cshtml
   ├─ Details.cshtml
   ├─ Create.cshtml
   └─ Edit.cshtml
```

- Controller、ViewModel 與 View 放在自己的 Area。
- Area 專用 CSS 放 `wwwroot/css/areas/<area>.css`。
- Area 專用 JavaScript 放 `wwwroot/js/areas/<area>.js`。
- Entity 代表資料表，只在 Controller／Service 與 EF Core 之間使用；View 一律使用 ViewModel。
- 共用 Layout、`Program.cs`、DbContext、Entity 或套件要修改時，先說明影響範圍。

## 五個 Area 的最低 CRUD 範圍

下表定義目前後台應提供的管理功能。實體刪除只適用於沒有外鍵、交易或歷史用途的測試資料；其他資料使用停用、隱藏、取消或封存狀態。

| Area | 最低清單與詳細頁 | 新增與修改 | 刪除或狀態操作 |
| --- | --- | --- | --- |
| `Catalog` | 文物、分類、年代、題庫設定 | 新增與修改文物基本資料、分類及年代；維護題庫啟用與難度 | 未被使用的測試分類可刪除；正式文物使用啟用／停用，不刪除已連結商品或題庫的文物 |
| `Game` | 房間、玩家、回合、作答、投票 | 建立房間與回合；修改尚未開始的房間設定 | 等待中的測試房間可取消；已完成房間、回合、作答與投票保留歷史，不做實體刪除 |
| `Social` | 貼文（含官方公告類型）、留言、檢舉、活動與報名 | 新增與修改貼文、活動；管理留言與檢舉處理結果 | 貼文與留言使用隱藏／刪除狀態；已有報名的活動不直接刪除 |
| `User` | Identity 帳號、Profile、地址、成就與會員成就 | 使用 Identity API 維護 Email、鎖定與角色；使用 DbContext CRUD Profile、地址與成就資料 | 帳號使用鎖定或停用；密碼、角色與 Token 不直接修改資料表；未被使用的地址或測試成就可依外鍵規則刪除 |
| `Store` | 商品、購物車、優惠券、訂單、付款與點數 | 新增與修改商品、庫存、優惠券；訂單與付款提供詳細頁與合法狀態操作 | 商品使用上架／下架；訂單、明細、付款與點數流水保留歷史，不做實體刪除 |

每個管理項目至少處理下列情況：有資料與空資料的 List、存在與不存在 Id 的 Details、合法與錯誤輸入、重複值、外鍵限制、未授權存取，以及 POST 完成後重新導向。完整單表範例見[從清單到完整 CRUD](05-crud-tutorial.md)。

## 開發順序

### 1. 先做唯讀頁面

先完成 Index 與 Details，確認關聯與資料內容理解正確。

```csharp
public async Task<IActionResult> Index(CancellationToken cancellationToken)
{
    var artifacts = await _db.Artifacts
        .AsNoTracking()
        .Include(artifact => artifact.Category)
        .Include(artifact => artifact.EraBucket)
        .OrderBy(artifact => artifact.Name)
        .ToListAsync(cancellationToken);

    return View(artifacts);
}
```

列表與詳細頁若不會修改資料，使用 `AsNoTracking()`。需要顯示關聯資料時使用 `Include()`，不要在 View 裡另外查資料庫。

### 2. 再做新增與編輯

表單使用 ViewModel，只接收允許修改的欄位。POST Action 先檢查 `ModelState`，成功後再寫入資料庫。以下使用欄位較單純的 `ArtifactCategory` 示範完整新增流程：

```csharp
[Required(ErrorMessage = "請輸入分類代碼。")]
[StringLength(32, ErrorMessage = "分類代碼最多 32 個字元。")]
public string Code { get; set; } = string.Empty;

[Required(ErrorMessage = "請輸入分類名稱。")]
[StringLength(80, ErrorMessage = "分類名稱最多 80 個字元。")]
public string Name { get; set; } = string.Empty;
```

上面兩個屬性應放在 Area 的 ViewModel 類別中。Controller 的 POST Action：

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create(
    CreateCategoryViewModel input,
    CancellationToken cancellationToken)
{
    if (!ModelState.IsValid)
    {
        return View(input);
    }

    var code = input.Code.Trim();
    var codeExists = await _db.ArtifactCategories
        .AnyAsync(category => category.Code == code, cancellationToken);

    if (codeExists)
    {
        ModelState.AddModelError(nameof(input.Code), "分類代碼已存在。");
        return View(input);
    }

    var category = new ArtifactCategory
    {
        Id = Guid.NewGuid(),
        Code = code,
        Name = input.Name.Trim()
    };

    _db.ArtifactCategories.Add(category);
    await _db.SaveChangesAsync(cancellationToken);

    return RedirectToAction(nameof(Index));
}
```

`Required` 與 `StringLength` 需要 `System.ComponentModel.DataAnnotations`；`AnyAsync` 需要 `Microsoft.EntityFrameworkCore`。實際 ViewModel 請建立完整類別與 namespace，不要把屬性直接放在 Controller。

### 3. 加入驗證與錯誤處理

- 驗證外鍵指定的資料是否存在。
- 唯一欄位先做友善檢查，仍要處理資料庫唯一索引例外。
- POST 一律使用 Anti-forgery。
- 成功後採 Post/Redirect/Get，避免重新整理造成重複送出。
- 有 `rowversion` 的資料表，才需要帶回表單並處理 `DbUpdateConcurrencyException`。
- 刪除前確認外鍵與業務狀態；多數後台資料較適合改狀態，不適合直接刪除。

### 4. 寫入功能接上授權，再處理跨表流程

- 需要登入的 Controller 或 Action 加上 `[Authorize]`；不要等到所有 CRUD 寫完才補授權。
- 管理功能使用角色或 Policy，不只在畫面隱藏按鈕。
- 目前登入者使用 `UserManager<ApplicationUser>` 取得，不解析顯示名稱代替 UserId。
- 點數、庫存、訂單、付款或遊戲結算若同時更新多張表，使用同一個 scoped DbContext 與交易。

完整程式範例見[QmahDbContext 使用方式](07-dbcontext-usage.md)。Identity 的目前實作範圍見[Identity 與會員資料管理](09-midterm-identity.md)。

## Scaffold 的正確用途

Visual Studio 的 **Add → New Scaffolded Item → MVC Controller with views, using Entity Framework** 可快速建立單表 CRUD 起始碼。

完整操作步驟見[Visual Studio Scaffold 操作教學](06-scaffolding-guide.md)。

產生後仍要逐項檢查：

- Area 路由與 Controller namespace。
- 表單是否改用適當 ViewModel。
- 不應顯示或修改的欄位是否移除。
- 查詢是否需要 `AsNoTracking()`、`Include()`、分頁與排序。
- POST 是否有授權、Anti-forgery、外鍵與並行更新處理。
- 錯誤訊息是否能讓使用者知道如何修正。

Scaffold 不負責 Identity 規則、跨表交易、付款、庫存、點數、通知或遊戲狀態。

`Program.cs` 已全域套用 `AutoValidateAntiforgeryTokenAttribute`，所有非 GET MVC Action 都會驗證 Token。Scaffold 產生的 `[ValidateAntiForgeryToken]` 可保留，作用與全域規則一致。

## 完成一項功能前

- 正常資料、空資料與錯誤輸入都能處理。
- 無權限的使用者不能只靠輸入網址進入後台。
- 查詢沒有在迴圈中重複存取資料庫。
- 寫入後資料庫結果、關聯與狀態正確。
- 頁面不直接顯示例外或敏感資訊。
- 專案可建置，瀏覽器 Console 沒有未處理錯誤。
- PR 說明有列出資料表、網址、共用檔案與驗證方式。
