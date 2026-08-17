# QMAH Tabler 後台實作指南

本文件說明 QMAH 後台共用介面的使用方式，適用於 Catalog、Game、Social、Store 與 User 系統的功能負責人。

## 最新套版方法：給組員的快速說明

1. 先同步最新版 `main`。五個 Area 都已經有 `Areas/<Area>/Views/_ViewStart.cshtml`，不必再自己建立，也不必在每一頁重寫 `Layout`。
2. Controller 對應的完整 View 只放自己的 CRUD 內容，例如標題資料、搜尋表單、Card、Table 與按鈕；不要再加入 `page`、`page-wrapper`、Sidebar、Navbar 或整份 HTML 外框。
3. 頁面標題使用 `ViewData["Title"]`，說明使用 `ViewData["AdminDescription"]`，右上角按鈕放在 `@section PageActions`。
4. Scaffold 後若看到 `Layout = null`，請移除。Partial View 本身不會產生 Layout，應由一般 View 引用。
5. View 自己的 CSS 請加上功能專用 class 作為範圍，例如 `.social-post-list`，不要直接改 `.page`、`.navbar`、`.page-wrapper`、`header` 或 `body`，否則可能蓋掉共用外框。

最小完整 View 範例：

```cshtml
@{
    ViewData["Title"] = "社群討論區";
    ViewData["AdminDescription"] = "管理社群貼文與討論內容";
}

@section PageActions {
    <a class="btn btn-primary" asp-action="Create">發表新貼文</a>
}

<div class="social-post-list">
    <!-- 此處只放自己的 CRUD UI -->
</div>
```

成功套用後，畫面應同時看得到 Sidebar、頂部工具列、共用頁首與自己的 CRUD 內容。只出現其中一部分不算完整成功。

## 懶人包：新建後台 View 要做什麼

1. Catalog、Game、Social、Store、User 已各自建立 `Views/_ViewStart.cshtml`，並指定 `/Views/Shared/Admin/_AdminLayout.cshtml`。
2. 在這五個 Area 新建的完整 View 會自動擁有 Tabler CSS／JavaScript、Sidebar、Navbar、頁首、提示訊息、頁尾與右側主要內容區。
3. 個別 View 只需提供要放進 `@RenderBody()` 的 CRUD 內容，不需要自行建立外框或預留側邊欄寬度。
4. Scaffold 產生的 View 可能有 `Layout = null`，這會覆蓋 `_ViewStart.cshtml`；產生後請檢查並移除，或在 Scaffold 視窗選擇使用 Layout。
5. Admin Layout 只會自動提供後台外框。View 內的 Card、Table、Form 和按鈕仍要使用本文範例或 Tabler 官方 class。
6. 專案目前沒有自訂 Scaffold templates，所以 Visual Studio 不會自動產生 QMAH Tabler CRUD markup；未來若要自動化，可再新增 project-local `Templates/ViewGenerator/Bootstrap5` templates。

正常畫面在桌機會是「左側固定側邊欄＋右側主要內容區」，組員新增 View 的 CRUD UI 會放進右側內容區。若側邊欄撐滿整個畫面、Navbar 和 CRUD 內容被排到頁面下方，這不是 `_ViewStart.cshtml` 的正常結果；請先確認 `wwwroot/admin/vendor/tabler/tabler.min.css` 是否完整載入，不要靠個別 View 加 margin 或複製 Layout 來補救。

專案已內建 Tabler 1.4.0，並完成共用側邊欄、頂部工具列、QMAH 配色、明暗模式與手機版導覽。一般功能開發不需要安裝 Node.js，也不需要另外下載 Tabler。

共用後台介面已經完成。`QMAH.Web/Areas/_ViewStart.cshtml` 仍保留一般網站的 `_Layout.cshtml`，五個後台 Area 則各自由 `Views/_ViewStart.cshtml` 覆寫為 `_AdminLayout.cshtml`，避免影響其他 Area。

完成 Layout 設定後，側邊欄、頂部工具列與明暗模式會由共用介面提供，不應在個別 Area 重複實作。功能負責人仍需實作所負責系統的資料表、查詢表單、編輯表單與業務流程。

## 共用介面包含的功能

使用共用後台 Layout 後，頁面會自動擁有：

- QMAH Logo
- 總覽與五大系統導覽
- 目前 Area 的選單標示
- 頁面標題與說明
- 頁首右上方操作按鈕區
- 明暗模式切換
- 手機版側邊欄
- 帳號選單
- 成功、提醒與錯誤訊息
- 統一內容寬度與頁尾
- Tabler CSS 與 JavaScript

明暗模式按鈕會以按鈕位置為中心播放圓形光圈轉場。使用者若在系統開啟「減少動態效果」，或瀏覽器不支援 View Transition API，會自動改用無動畫切換，不影響功能。

Sidebar 的五個主要按鈕會切換 Catalog、Game、Social、Store 與 User。CRUD Controller 可自行選擇是否加入目前 Area 的次級選單；加入後，共用 Sidebar 會自動建立連結並標示目前 Controller。

CRUD Controller 可使用 `AdminNavigation` 指定次級選單的中文名稱與順序：

```csharp
using QMAH.Web.Infrastructure.AdminNavigation;

[Area("Catalog")]
[AdminNavigation("文物分類", order: 10)]
public class ArtifactCategoryController : Controller
{
    public IActionResult Index() => View();
}
```

只有加上 `AdminNavigation` 且具有 `Index` Action 的 Controller 才會出現在次級選單。未加 Attribute 不會影響 Controller、路由、Scaffold 或 View，方便各 Area 自行決定哪些 CRUD 功能需要顯示。

上述內容會由共用 Layout 自動產生，不需要複製到系統 View。這裡的「自動」只指後台外框；載入 Tabler CSS 與 JavaScript 不會自動將 Scaffold 產生的 HTML 改成 Tabler Card、Table 或 Form。

`@RenderBody()` 對應的主要內容區已由 Layout 預留。桌機版位於固定側邊欄右側，手機版則移到導覽列下方；個別 View 不需要自行預留側邊欄寬度，也不應再加入 `page` 或 `page-wrapper`。

Visual Studio Scaffold 預設只會產生一般 CRUD 骨架。`card`、`table-vcenter`、`card-table`、`form-label` 與頁面排列等 Tabler markup，目前仍需依本文範例調整。

## 開始使用

### 1. 在 View 指定後台 Layout

在 `.cshtml` 最上方加入：

```cshtml
@{
    Layout = "/Views/Shared/Admin/_AdminLayout.cshtml";
    ViewData["Title"] = "頁面名稱";
    ViewData["AdminDescription"] = "以一句話說明此頁面的用途。";
}
```

Layout 設定完成後，即可加入該頁面的實際內容：

```cshtml
@{
    Layout = "/Views/Shared/Admin/_AdminLayout.cshtml";
    ViewData["Title"] = "文物分類管理";
    ViewData["AdminDescription"] = "查詢與維護圖鑑使用的文物分類。";
}

<div class="card">
    <div class="card-body">
        此處放置文物分類的查詢表單與資料表。
    </div>
</div>
```

此 View 已套用完整後台骨架。View 內不需要再次加入 `page`、`page-wrapper`、`page-header`、`page-body` 或 `container-xl`。

### 2. 在 Area 統一設定後台 Layout

若所負責 Area 的所有 View 都是後台頁面，標準作法是在該 Area 的 `Views/_ViewStart.cshtml` 統一指定。例如 User Area 的檔案位置是：

```text
QMAH.Web/Areas/User/Views/_ViewStart.cshtml
```

目前 Catalog、Game、Social、Store、User 都已經有這份 Area 專用檔案，不需要由功能負責人重複建立。若未來新增第六個後台 Area，建立方式如下：

1. 在 Solution Explorer 對 `Areas/<Area>/Views` 資料夾按右鍵。
2. 選 **Add** → **New Item...**。
3. 選 **Razor View - Empty**，檔名輸入 `_ViewStart.cshtml`。
4. 將內容改為：

```cshtml
@{
    Layout = "/Views/Shared/Admin/_AdminLayout.cshtml";
}
```

設定後，該 Area 內的 View 不需要逐頁重複指定 `Layout`。

每個 Area 各自建立 `Views/_ViewStart.cshtml` 是 ASP.NET Core Razor 正常的階層式用法，適合由不同負責人維護，也可避免誤傷前台頁面。若五個 Area 未來確定全部都只有後台 View，也可由團隊統一將 `QMAH.Web/Areas/_ViewStart.cshtml` 改成 Admin Layout，就不需要建立五份相同檔案。這是會影響所有 Area 的共用決定，不應由個別功能負責人自行修改。

如果同一個 Area 同時有前台與後台頁面，請將 `_ViewStart.cshtml` 放在更小的 View 資料夾，或逐頁指定 Layout，不要讓整個 Area 都使用 Admin Layout。

Scaffold 產生的完整 View 可能自己寫入 `Layout = null`。View 內的 Layout 設定會覆蓋 `_ViewStart.cshtml`，因此產生後要移除 `Layout = null`，或在 Scaffold 視窗選擇使用 Layout。Partial View 不會執行 `_ViewStart.cshtml`；它被完整後台 View 引用時，會顯示在外層 View 的 Admin Layout 中。

### 3. 設定頁首操作按鈕

使用 `PageActions`：

```cshtml
@section PageActions {
    <a class="btn btn-primary" asp-action="Create">新增文物分類</a>
}
```

Layout 會處理桌面排列與手機換行。一般頁面不應在 View 內另建一套頁首。

## 查閱 Tabler 官方元件

可先從 [Tabler 官方預覽](https://preview.tabler.io/) 確認可用元件，再到 [Tabler 官方文件](https://docs.tabler.io/) 查閱範例程式碼。

官方文件提供一般 HTML 範例。實作時可保留元件的 HTML 結構與 class，再將網址、資料與欄位改成 Razor 寫法。

### 常用文件

| 開發需求 | 官方文件 | QMAH 使用方式 |
| --- | --- | --- |
| 安排欄位與 RWD | [Layout](https://docs.tabler.io/ui/layout)、[Page layouts](https://docs.tabler.io/ui/layout/page-layouts/) | 使用 `row`、`col-*`、spacing 與 flex utilities 排版。外層 Layout 已由專案提供，不需複製官方的完整頁面結構。 |
| 頁面標題 | [Page headers](https://docs.tabler.io/ui/layout/page-headers/) | QMAH 一般頁面已由 `ViewData` 和 `PageActions` 處理。僅特殊版面需要自訂頁首。 |
| 按鈕 | [Buttons](https://docs.tabler.io/ui/components/buttons/) | 儲存、新增等主要動作用 `btn-primary`；取消、返回用 `btn-outline-secondary`。 |
| 內容區塊 | [Cards](https://docs.tabler.io/ui/components/cards/) | 適合呈現一份表單、一張資料表或一組有明確關係的內容。一般文字段落不需要額外包成 Card。 |
| 資料表 | [Tables](https://docs.tabler.io/ui/components/tables/) | 使用 Tabler 的 table class，並在外層加入 `table-responsive`。 |
| 表單 | [Forms](https://docs.tabler.io/ui/forms/) | 說明 input、select、textarea、switch、checkbox 與欄位排列方式。 |
| 驗證錯誤 | [Validation states](https://docs.tabler.io/ui/forms/form-validation/) | 畫面樣式可以參考 Tabler，但驗證結果仍以 ASP.NET Core ModelState 為準。 |
| 下拉選單 | [Dropdowns](https://docs.tabler.io/ui/components/dropdowns/) | 保留 `data-bs-toggle="dropdown"`，開關行為由 Tabler JavaScript 提供。 |
| 確認視窗 | [Modals](https://docs.tabler.io/ui/components/modals/) | 適合刪除確認或簡短操作。完整新增／編輯流程原則上應使用獨立頁面。 |
| 分頁 | [Pagination](https://docs.tabler.io/ui/components/pagination/) | 樣式可參考 Tabler；頁碼、查詢條件與總頁數仍由該系統的後端資料決定。 |
| 狀態 | [Statuses](https://docs.tabler.io/ui/components/statuses/) | 顯示啟用、停用、成功、警告或錯誤。相同狀態應維持相同顏色與名稱。 |
| 沒有資料 | [Empty states](https://docs.tabler.io/ui/components/empty/) | 空資料畫面應說明目前沒有資料，並提供適當的下一步操作。 |
| 圖示 | [Icons](https://docs.tabler.io/ui/components/icons/) | 使用一致的 Tabler 線條圖示。請勿使用 emoji 或單一中文字代替介面圖示。 |
| 調整 Tabler | [Customize Tabler](https://docs.tabler.io/ui/getting-started/customize/) | 可了解 CSS variables 的做法。QMAH 共用配色已設定完成，個別 Area 不應重新設定全域主色。 |

[Installation](https://docs.tabler.io/ui/getting-started/installation) 會示範 CDN 安裝，但 QMAH 已完成本機資產配置。該頁僅供了解 Tabler 的 CSS／JavaScript 結構，請勿將 CDN `<link>` 或 `<script>` 加入 View。

## 常用頁面範例

以下使用專案既有的 `catalog.ArtifactCategories` 與第 5 份 CRUD 教學示範 Tabler 寫法。範例中的 ViewModel 名稱、欄位與 Action 都和該教學一致，不另外假設資料庫有審核欄位。

完整 Controller、ViewModel 與資料存取流程請接續閱讀[從清單到完整 CRUD](05-crud-tutorial.md)。本文件只補充共用 Layout 與 Tabler 元件的組合方式。

### 查詢列

```cshtml
@{
    var keyword = ViewData["Keyword"] as string;
}

<form asp-action="Index" method="get" class="card mb-3">
    <div class="card-body">
        <div class="row g-3 align-items-end">
            <div class="col-md-8">
                <label class="form-label" for="keyword">關鍵字</label>
                <input class="form-control"
                       id="keyword"
                       name="keyword"
                       value="@keyword"
                       placeholder="搜尋分類代碼或名稱" />
            </div>
            <div class="col-md-4">
                <div class="d-flex gap-2">
                    <button class="btn btn-primary flex-fill" type="submit">查詢</button>
                    <a class="btn btn-outline-secondary" asp-action="Index">清除</a>
                </div>
            </div>
        </div>
    </div>
</form>
```

GET 查詢應把條件放在網址中，重新整理或分享網址時才不會遺失條件。

`ArtifactCategory` 只有代碼、名稱與關聯資料，沒有啟用或審核欄位，因此這裡不顯示狀態篩選。其他頁面也要依目前 Entity 的實際欄位設計：

| 資料 | 現有狀態欄位 |
| --- | --- |
| 圖鑑文物 `Artifact` | `IsActive` |
| 遊戲題庫設定 `ArtifactQuestionEntry` | `IsEnabled` |
| 遊戲房間 `GameRoom` | `Status`、`Visibility` |
| 社群貼文 `SocialPost` | `Status` |
| 商城商品 `Product` | `IsActive` |
| 會員 `ApplicationUser` | `Status` |
| 會員成就 `Achievement` | `Status` |

例如商品的 `IsActive` 可以在畫面顯示為「上架／下架」，文物的 `IsActive` 可以顯示為「啟用／停用」。不要把兩者都改成資料庫不存在的「待審核／已通過」。

### 資料表

```cshtml
@model IReadOnlyList<QMAH.Web.Areas.Catalog.ViewModels.ArtifactCategoryListItemViewModel>

<div class="card">
    <div class="card-header">
        <div>
            <h2 class="card-title mb-1">文物分類</h2>
            <div class="card-subtitle">共 @Model.Count 筆</div>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-vcenter table-hover card-table">
            <thead>
                <tr>
                    <th>分類代碼</th>
                    <th>分類名稱</th>
                    <th class="text-end">文物數量</th>
                    <th class="w-1">操作</th>
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
                            <a class="btn btn-sm btn-outline-secondary"
                               asp-action="Edit"
                               asp-route-id="@item.Id">編輯</a>
                        </td>
                    </tr>
                }
            </tbody>
        </table>
    </div>
</div>
```

表格欄位較多時，應保留 `table-responsive`，讓手機使用者可以水平捲動。欄位文字不應為了塞入手機畫面而縮小到難以閱讀。

### 編輯表單

```cshtml
@model QMAH.Web.Areas.Catalog.ViewModels.ArtifactCategoryFormViewModel

<form asp-action="Edit" method="post" class="card">
    <div class="card-header">
        <h2 class="card-title">分類資料</h2>
    </div>

    <div class="card-body">
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
    </div>

    <div class="card-footer d-flex justify-content-end gap-2">
        <a class="btn btn-outline-secondary" asp-action="Index">取消</a>
        <button class="btn btn-primary" type="submit">儲存</button>
    </div>
</form>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

POST Action 仍要檢查 `ModelState.IsValid`。Tabler 只負責畫面，不會取代 ASP.NET Core 驗證。

### 空資料

```cshtml
@if (Model.Count == 0)
{
    <div class="card">
        <div class="empty">
            <p class="empty-title">目前沒有資料</p>
            <p class="empty-subtitle text-secondary">
                請調整搜尋條件，或新增第一筆文物分類。
            </p>
            <div class="empty-action">
                <a class="btn btn-primary" asp-action="Create">新增文物分類</a>
            </div>
        </div>
    </div>
}
```

若目前登入者沒有新增權限，畫面不應顯示「新增文物分類」按鈕。

## 系統專用 CSS 與 JavaScript

Area 專用 CSS／JavaScript 繼續放在既有資料夾：

```text
QMAH.Web/wwwroot/css/areas/
QMAH.Web/wwwroot/js/areas/
```

目前五個 Area 已各自保留一份 CSS 與 JavaScript：

| Area | CSS | JavaScript |
| --- | --- | --- |
| Catalog | `catalog.css` | `catalog.js` |
| Game | `game.css` | `game.js` |
| Social | `social.css` | `social.js` |
| Store | `store.css` | `store.js` |
| User | `user.css` | `user.js` |

例如 Catalog View 使用 Razor section 載入：

```cshtml
@section Styles {
    <link rel="stylesheet" href="~/css/areas/catalog.css" asp-append-version="true" />
}

@section Scripts {
    <script src="~/js/areas/catalog.js" asp-append-version="true"></script>
}
```

系統專用樣式與互動應放在所負責 Area 的檔案中，不應加入 `qmah-admin-core.css` 或 `qmah-tabler.css`。

## 顯示操作結果

共用 Layout 會自動讀取以下 `TempData`：

```csharp
TempData["Success"] = "資料已儲存。";
TempData["Info"] = "資料沒有變更。";
TempData["Warning"] = "部分欄位仍待確認。";
TempData["Error"] = "儲存失敗，請稍後再試。";
```

例如儲存成功後：

```csharp
TempData["Success"] = "資料已儲存。";
return RedirectToAction(nameof(Index));
```

下一頁會自動顯示可關閉的提示訊息，不需要在每個 View 重複寫 Alert。

## QMAH 配色怎麼用

共用 CSS 已設定淺色與深色模式。Area CSS 應使用以下變數，不應另建一套主色：

| 變數 | 用途 |
| --- | --- |
| `--qmah-primary` | 主要按鈕、連結與目前選取狀態 |
| `--qmah-primary-hover` | 主要元件的 hover／active 狀態 |
| `--qmah-celadon` | 低調輔色 |
| `--qmah-cinnabar` | 刪除、錯誤或危險狀態 |
| `--qmah-bronze` | 提醒或次要文化色彩 |
| `--qmah-porcelain` | 頁面底色 |
| `--qmah-surface`、`--qmah-surface-soft` | Card、表格標題列與其他表面 |
| `--qmah-ink`、`--qmah-ink-soft` | 主要文字與次要文字 |
| `--qmah-line`、`--qmah-line-soft` | 邊框與分隔線 |
| `--qmah-success` | 成功或啟用 |
| `--qmah-warning` | 需要注意 |
| `--qmah-danger` | 錯誤、刪除或高風險操作 |
| `--qmah-info` | 一般資訊 |

範例：

```css
.catalog-source-note {
    border: 1px solid var(--qmah-line);
    background: var(--qmah-surface-soft);
    color: var(--qmah-ink-soft);
}
```

這些變數會在深色模式自動切換，不需要另外建立一整份 `body.dark` 配色。

## 共用介面使用限制

- 請勿重新實作 Sidebar、Navbar、頁首、頁尾或明暗模式。
- 請勿在 View 內再次載入 Bootstrap 或 Tabler。
- 請勿使用 CDN 版本的 Tabler。
- 請勿修改 `tabler.min.css` 或 `tabler.min.js`。
- 若只需調整單一元件，請勿複製整份 Tabler CSS。
- Area 業務樣式不應寫入共用後台 CSS。
- 功能負責人不得新增或修改其他系統的 Area 檔案。
- 介面圖示請勿使用 emoji、中文字圓圈或自行製作的大型色塊代替。
- 資料列不應逐筆包成獨立 Card，應依資料用途選擇表格或清單。
- 頁面必須確認手機版可操作，且整體版面不會出現非預期的水平捲動。

## 常見問題

### 頁面還是舊版導覽列

確認 View 或該 Area 的 `_ViewStart.cshtml` 是否指定：

```cshtml
Layout = "/Views/Shared/Admin/_AdminLayout.cshtml";
```

如果是 Scaffold 產生的 View，再檢查檔案內是否有：

```cshtml
Layout = null;
```

有的話會覆蓋 `_ViewStart.cshtml`，請移除這行或改成 Admin Layout。如果 Controller 回傳的是 Partial View，則本來就不會包含完整後台外框。

### 樣式完全沒有出現

先確認頁面使用 `_AdminLayout.cshtml`，再確認瀏覽器 Network 沒有出現以下檔案的 404：

```text
/admin/vendor/tabler/tabler.min.css
/admin/css/qmah-admin-core.css
/admin/css/qmah-tabler.css
```

### Dropdown 或 Modal 按了沒反應

請勿加入另一份 Bootstrap JavaScript。請確認按鈕保留官方範例需要的 `data-bs-toggle` 與 `data-bs-target`，並確認 `/admin/vendor/tabler/tabler.min.js` 沒有載入失敗。

### 深色模式顏色異常

常見原因是 Area CSS 寫死白色、黑色或背景色。請將硬編碼顏色改為 `--qmah-*` 變數，並沿用共用明暗模式，不應另建第二套切換器。

### 手機版表格超出畫面

表格外層應該有：

```html
<div class="table-responsive">
    <table class="table">...</table>
</div>
```

表格本身可以水平捲動，但整個網頁不應該左右滑動。

### 驗證訊息沒有出現

確認 View 有 `asp-validation-for`，POST Action 在驗證失敗時回傳原本 View，而且沒有在 `ModelState.IsValid == false` 時直接 Redirect。

## 共用檔案在哪裡

| 內容 | 檔案位置 |
| --- | --- |
| 共用 Layout | `QMAH.Web/Views/Shared/Admin/_AdminLayout.cshtml` |
| 側邊欄 | `QMAH.Web/Views/Shared/Admin/_AdminSidebar.cshtml` |
| 頂部工具列 | `QMAH.Web/Views/Shared/Admin/_AdminNavbar.cshtml` |
| 共用提示訊息 | `QMAH.Web/Views/Shared/Admin/_AdminAlerts.cshtml` |
| 共用導覽圖示 | `QMAH.Web/Views/Shared/Admin/_Icon.cshtml` |
| QMAH 基礎變數 | `QMAH.Web/wwwroot/admin/css/qmah-admin-core.css` |
| Tabler 視覺調整 | `QMAH.Web/wwwroot/admin/css/qmah-tabler.css` |
| 明暗模式 | `QMAH.Web/wwwroot/admin/js/qmah-admin.js` |
| Tabler 編譯資產 | `QMAH.Web/wwwroot/admin/vendor/tabler/` |

一般功能開發不需要修改上述共用檔案。若調整項目確定適用於所有 Area，應交由共用介面維護者統一修改。

## 完成頁面前檢查

- [ ] 只修改所負責的 Area 與該 Area 專用的 CSS／JavaScript。
- [ ] 頁面已透過 View 或 Area 的 `_ViewStart.cshtml` 套用 `_AdminLayout.cshtml`。
- [ ] 有設定 `ViewData["Title"]`。
- [ ] 畫面欄位、狀態與操作都對應目前的 Entity、ViewModel 與業務規則，沒有自行新增資料庫不存在的欄位或狀態。
- [ ] 頁首有操作按鈕時，使用 `PageActions`。
- [ ] 優先使用 Tabler 官方元件與 class。
- [ ] 有 POST 表單時，後端會檢查 ModelState 並顯示欄位錯誤。
- [ ] POST 成功後使用 PRG（POST → Redirect → GET），避免重新整理時重複送出。
- [ ] 有查詢或分頁時，切換頁碼後仍會保留查詢條件。
- [ ] 沒有資料或找不到符合條件的資料時，畫面有清楚的空資料訊息。
- [ ] 文物或商品圖片使用資料庫保存的路徑；需要顯示來源時，同時保留來源網址與姓名標示。
- [ ] 沒有重複載入 Bootstrap、Tabler 或其他 UI framework。
- [ ] 沒有修改 `tabler.min.css`、`tabler.min.js` 或非本人負責的 Area。
- [ ] 淺色模式文字看得清楚。
- [ ] 深色模式文字、表格與表單看得清楚。
- [ ] 手機版按鈕、表格與表單可以操作。
- [ ] 鍵盤 Tab 可以看見焦點位置。
- [ ] 瀏覽器 Console 沒有未處理錯誤，Network 沒有 CSS、JavaScript、圖片或字型 404。
- [ ] 執行 `dotnet build` 沒有錯誤。

責任邊界如下：Tabler 負責元件外觀與前端互動；Razor／MVC 負責資料、路由、權限、ModelState 驗證與業務流程。
