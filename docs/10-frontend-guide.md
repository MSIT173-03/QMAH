# Razor 後台與前台銜接手冊

目前可操作的管理畫面使用 Razor View、HTML、CSS、Bootstrap、JavaScript、jQuery 與 ASP.NET Core Model Validation，位於 `QMAH.Web`。Angular 前台另位於 `QMAH.Client`，目前只保留 CLI 產生的骨架，不在本文件開始製作前台頁面。

Razor 後台的 Bootstrap、jQuery 與驗證套件已放在 `QMAH.Web/wwwroot/lib`，Tabler icon font 與後台所需的 Tabler 資產則放在 `QMAH.Web/wwwroot/admin/vendor`，Clone 後不需要再透過 npm、LibMan 或外部 CDN 下載。共用 Layout 使用 Repository 內固定版本的檔案，沒有外網時也能維持核心版面與圖示。不要再加入第二份前端函式庫或未固定版本的 CDN。Angular 的 npm 依賴與 API 呼叫方式請看 [`12-frontend-start-guide.md`](12-frontend-start-guide.md) 與 [`13-rest-api.md`](13-rest-api.md)。

## 共用前端版本

| 函式庫 | 版本 | 用途 |
| --- | ---: | --- |
| Bootstrap | 5.3.8 | Grid、排版、表單與互動元件 |
| jQuery | 3.7.1 | 簡單 DOM 操作、事件與 AJAX |
| jQuery Validation | 1.22.1 | 使用者端欄位驗證 |
| jQuery Validation Unobtrusive | 4.0.0 | 將 ASP.NET Core 驗證規則接到 jQuery Validation |

共用後台版型 [`_AdminLayout.cshtml`](../QMAH.Web/Views/Shared/Admin/_AdminLayout.cshtml) 已載入：

- Tabler、Bootstrap、後台共用 CSS。
- jQuery 與後台 JavaScript。
- 防錯誤、主題、導覽與共用互動腳本。
- 選用的 `Styles` 與 `Scripts` section。

後台 Area View 不需要重複載入這些共用檔案；Angular 元件則使用自己的 `angular.json` 與 npm bundle，不與 Razor Layout 混用。

## View 放置位置

Area 的 View 使用以下結構：

```text
QMAH.Web/Areas/<Area>/Views/<Controller>/<Action>.cshtml
```

例如：

```text
QMAH.Web/Areas/Catalog/Views/Artifact/Index.cshtml
```

Controller 必須有正確的 `[Area("Catalog")]`，導覽連結則明確指定 `asp-area`：

```cshtml
<a asp-area="Catalog"
   asp-controller="Artifact"
   asp-action="Index">
    查看圖鑑
</a>
```

不要手寫 `/Catalog/Artifact/Index?id=...` 字串。使用 Tag Helper 可以跟著路由與參數產生正確網址。

> **微軟官方做法：** MVC 的 Anchor Tag Helper 會依 Area、Controller、Action 與 route values 產生連結，避免路由調整後留下硬編碼網址。[Anchor Tag Helper in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/mvc/views/tag-helpers/built-in/anchor-tag-helper?view=aspnetcore-10.0)

## 開發順序

1. 先確認 Controller 已能取得正確資料。
2. 完成 Index 與 Details，檢查空資料、長文字與失效圖片。
3. 再建立 Create、Edit 與狀態操作。
4. 補齊後端 ModelState、錯誤訊息與重新顯示表單的資料。
5. 加入 Area 專用 CSS 與必要 JavaScript。
6. 檢查桌面與窄螢幕、鍵盤操作、錯誤輸入及重複送出。

先讓資料流與操作正確，再調整視覺細節。不要在 Controller 尚未完成時，就把大量假資料直接寫進 Razor。

## 共用版型與 section

所有後台頁面使用共用 `_AdminLayout.cshtml`。頁面標題寫入 `ViewData`：

```cshtml
@{
    ViewData["Title"] = "文物圖鑑";
}
```

頁面或 Area 專用 CSS 放進 `Styles` section：

```cshtml
@section Styles {
    <link rel="stylesheet"
          href="~/css/areas/catalog.css"
          asp-append-version="true" />
}
```

頁面 JavaScript 放進 `Scripts` section，讓它在 jQuery、Bootstrap 與 `site.js` 之後載入：

```cshtml
@section Scripts {
    <script src="~/js/areas/catalog.js"
            asp-append-version="true"></script>
}
```

`asp-append-version="true"` 會在網址加入內容雜湊，檔案更新後可避免瀏覽器繼續使用舊快取。後台字體放在 `wwwroot/fonts`，以 WOFF2 本地載入；Web 專案也會在傳輸時壓縮 CSS、JavaScript、HTML、JSON 與 SVG。CSS 仍依責任拆檔，方便維護，不需要為了傳輸而在原始碼合併。

## CSS 分工

| 檔案 | 適合內容 |
| --- | --- |
| `wwwroot/css/site.css` | 全站字型、色彩基礎、共用容器與共用元件 |
| `wwwroot/css/areas/game.css` | 遊戲 Area 專用樣式 |
| `wwwroot/css/areas/social.css` | 社群 Area 專用樣式 |
| `wwwroot/css/areas/catalog.css` | 圖鑑 Area 專用樣式 |
| `wwwroot/css/areas/user.css` | 會員 Area 專用樣式 |
| `wwwroot/css/areas/store.css` | 商城 Area 專用樣式 |
| `wwwroot/admin/css/qmah-fonts.css` | 後台本地字體與字體角色 |
| `wwwroot/admin/css/qmah-admin-typography.css` | 後台文字尺寸、階層與閱讀行高 |
| `*.cshtml.css` | 與單一 Razor View／元件緊密相關的 scoped CSS |

某個 Area 的頁面樣式不要整批塞進 `site.css`。只有兩個以上模組確定共用、命名與行為也一致時，才提升為全站樣式。

CSS class 使用功能或元件名稱，例如 `.artifact-card`、`.order-summary`；避免 `.red-text`、`.box2` 這種依外觀或順序命名的 class。

不要修改 Bootstrap 原始檔。需要覆寫時，在 `site.css` 或 Area CSS 使用自己的 class。

## Bootstrap 使用原則

Bootstrap 可直接使用，不需要額外引用：

```html
<button type="submit" class="btn btn-primary">儲存</button>
```

Grid、表單、Navbar、Modal、Collapse、Dropdown 與 Tooltip 都可使用。Bootstrap bundle 已包含 Popper。

Bootstrap 不是強制的頁面實作方式。自訂 CSS 仍不得破壞共用 Layout、導覽列與其他 Area，也不另行引入第二套完整 CSS framework。

互動元件要使用 Bootstrap 文件要求的 `data-bs-*` 屬性，不使用舊版 Bootstrap 4 的 `data-toggle`、`data-target`。

## Razor 輸出安全

Razor 預設會進行 HTML 編碼，直接使用 `@Model.Name` 即可。

除非內容經過明確且可靠的清理，不要使用 `Html.Raw()` 輸出貼文、留言、商品描述或其他使用者輸入。否則可能產生跨站腳本攻擊。

> **微軟官方建議：** Razor 的 `@` 輸出預設會進行 HTML 編碼；未受信任的輸入不應直接交給 `Html.Raw()`。這是避免 XSS 的基本邊界。[Prevent Cross-Site Scripting in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/security/cross-site-scripting?view=aspnetcore-10.0)

資料不存在時提供明確的空狀態：

```cshtml
@if (Model.Count == 0)
{
    <div class="alert alert-secondary" role="status">
        目前沒有可顯示的文物。
    </div>
}
```

不要讓空集合只留下整片空白，也不要以 JavaScript 取代原本可由 Razor 判斷的狀態。

## 表單與 Model Validation

表單使用 Tag Helper，POST Action 使用 `[ValidateAntiForgeryToken]`：

```cshtml
<form asp-area="Catalog"
      asp-controller="Artifact"
      asp-action="Create"
      method="post">
    <div asp-validation-summary="ModelOnly"
         class="text-danger"></div>

    <div class="mb-3">
        <label asp-for="Name" class="form-label"></label>
        <input asp-for="Name" class="form-control" />
        <span asp-validation-for="Name" class="text-danger"></span>
    </div>

    <button type="submit" class="btn btn-primary">儲存</button>
</form>
```

頁面最後載入驗證 partial：

```cshtml
@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

使用者端驗證只改善操作體驗，不能取代後端驗證。價格、庫存、UserId、角色、付款狀態、遊戲狀態與外鍵都要由 Controller 重新檢查。

> **微軟官方做法：** MVC 的 Form Tag Helper 會為 POST 表單產生防偽 Token，Controller 仍需驗證請求；前端驗證不能取代伺服器端的資料與授權檢查。[Prevent Cross-Site Request Forgery attacks](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0)

送出失敗回到 View 時，下拉選單、選項清單與其他畫面資料也要重新準備，不能只 `return View(model)` 後讓選單變空。

## 防止重複送出

表單送出後可暫時停用送出按鈕，避免使用者快速連點：

```javascript
$(function () {
    $("form[data-prevent-double-submit]").on("submit", function () {
        $(this).find("button[type='submit']").prop("disabled", true);
    });
});
```

前端停用按鈕不是完整保護。訂單、付款、點數與遊戲作答仍需由後端檢查狀態、唯一條件或冪等性。

## JavaScript 與 jQuery

一般 HTML、Razor 與 Bootstrap 能完成的功能，不需要額外改寫成 jQuery。

jQuery 適合簡單事件、元素切換與小型 AJAX：

```javascript
$(function () {
    $("[data-filter-target]").on("input", function () {
        const keyword = $(this).val().toString().trim().toLowerCase();

        $("[data-filter-item]").each(function () {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.includes(keyword));
        });
    });
});
```

JavaScript selector 優先使用 `data-*` 屬性，不要依賴純視覺 class。CSS 改名時，行為才不會一起壞掉。

Area JavaScript 不要修改其他 Area 的 DOM，也不要把整頁資料複製到全域變數。

## 圖片與靜態檔案

正式文物圖鑑圖片位於：

```text
QMAH.Web/wwwroot/media/catalog/{categoryCode}/{artifactRef}/
```

縮小複製品直接使用對應文物的 `/media/catalog/` 圖片，不建立第二份 Store 圖片。前端應使用資料庫的 `PrimaryImagePath`，不要自行拼接路徑。

商品頁直接顯示 `Product.SizeText`；這個欄位已由資料工具換算完成，不要在 JavaScript、Controller 或 View 再除以 2。需要顯示原作尺寸時，透過 `Product.ArtifactId` 讀取 `Artifact.SizeText`。

資料庫保存 `/media/...` 相對路徑，Razor 可直接使用：

```cshtml
<img src="@Model.ThumbnailPath"
     alt="@Model.Name"
     class="img-fluid"
     loading="lazy" />
```

圖片規則：

- `alt` 描述圖片內容；裝飾圖片使用空 `alt=""`。
- 清單縮圖可使用 `loading="lazy"`。
- 以 CSS 控制顯示尺寸，不用上傳超大圖再靠瀏覽器縮小。
- 圖片失效時顯示替代狀態，不把來源網址直接當網站圖片網址。
- 不把 Base64 圖片、下載快取或 raw 素材放進 Razor／JavaScript。

文物圖鑑圖片與社群上傳圖片是兩個不同的資料邊界。圖鑑素材維持既有分類／故宮編號資料夾與來源授權規則，不套用社群媒體的管理狀態。社群上傳圖片由 `social.MediaAssets` 保存檔案中繼資料，檔案使用簡單的永久流水號與副檔名，平面放在共用媒體根目錄；後台或 API 透過受控 Endpoint 讀取，不能直接當成公開靜態檔案。

社群圖片的預覽與下架由後台「營運中心 → 圖庫管理」處理。`OriginalFileName` 只作畫面顯示，不能直接拼成檔案路徑；上傳仍需驗證檔案大小、簽章、Content-Type、路徑邊界與貼文關聯。測試上傳檔案只留在本機，不要提交到 Repository。

## 響應式與可用性

至少檢查一般桌面寬度與窄螢幕。表格內容很多時，可使用 `.table-responsive`，但也要判斷手機上是否更適合卡片或摘要內容。

所有輸入欄位都要有可見 label。只有圖示的按鈕要有 `aria-label`。Modal 開啟、關閉與表單錯誤都要能用鍵盤操作。

不要只用顏色表示成功、失敗、庫存或遊戲答案；同時提供文字、圖示或狀態標籤。

## Area 前端檔案

各 Area 需要專屬樣式或腳本時，再在自己的 Area 檔案區新增：

```text
wwwroot/css/areas/game.css
wwwroot/css/areas/social.css
wwwroot/css/areas/catalog.css
wwwroot/css/areas/user.css
wwwroot/css/areas/store.css

wwwroot/js/areas/game.js
wwwroot/js/areas/social.js
wwwroot/js/areas/catalog.js
wwwroot/js/areas/user.js
wwwroot/js/areas/store.js
```

頁面只載入實際使用的檔案。兩個以上 Area 的需求與行為一致時，再將樣式或腳本移到 `site.css` 或 `site.js`。

## 常見問題

### CSS 或 JavaScript 修改後沒有變化

先確認 View 有載入正確 Area 檔案，網址使用 `asp-append-version="true"`，再執行瀏覽器強制重新整理。不要先去修改 Bootstrap 原始檔。

### `Styles` 或 `Scripts` section 無法顯示

確認 View 使用共用 Layout，section 名稱大小寫正確，而且 Partial View 沒有自行宣告 section。Section 應由完整 View 定義。

### ModelState 有錯，但畫面沒有訊息

確認 View 有 `asp-validation-summary`、每個欄位有 `asp-validation-for`，並載入 `_ValidationScriptsPartial`。後端仍要保留 ModelState 檢查。

### Modal、Dropdown 沒反應

確認使用 Bootstrap 5 的 `data-bs-*` 屬性，且頁面沒有重複載入不同版本 Bootstrap。共用 Layout 已載入 bundle，不需再加一次。

### 圖片在本機正常，其他人看不到

檢查資料庫是否存了本機絕對路徑，或圖片檔沒有加入 Repository。文物圖鑑正式路徑必須以 `/media/catalog/` 開頭，實體檔案位於 `wwwroot/media/catalog`；社群圖片則由 API／後台受控 Endpoint 提供，不能把本機上傳檔直接當公開靜態資源。

## 完成功能前檢查

- View 位於正確 Area、Controller 與 Action 路徑。
- 連結使用 `asp-area`、`asp-controller`、`asp-action`。
- 共用函式庫沒有重複載入。
- Area 樣式與 JavaScript 沒有污染其他模組。
- 表單有 label、驗證訊息、Anti-forgery 與後端驗證。
- 空資料、錯誤輸入、長文字、失效圖片與重複送出都有處理。
- 圖片使用網站相對路徑並提供適當 `alt`。
- 桌面與窄螢幕都能閱讀及操作。
- 瀏覽器 Console 沒有未處理錯誤。

完整 CRUD 與 Razor 表單範例見[從清單到完整 CRUD](05-crud-tutorial.md)。自動產生起始頁面的步驟見[Visual Studio Scaffold 操作教學](06-scaffolding-guide.md)。資料查詢與寫入方式見 [`07-dbcontext-usage.md`](07-dbcontext-usage.md)，套件與 Hot Reload 說明見 [`01-development-environment.md`](01-development-environment.md)。使用共用後台骨架與 Tabler 元件時，請接著閱讀 [`11-tabler-admin-guide.md`](11-tabler-admin-guide.md)。
