# 架構與資料存取規則

這裡規定五個 Area 共用 SQL Server、EF Core 與 ASP.NET Core Identity 時的資料存取界線。

## 目前採用的做法

```text
Razor View ⇄ ViewModel ⇄ Controller ⇄ [Service] ⇄ QmahDbContext ⇄ SQL Server
```

方括號表示 Service 依功能需要加入，不是每個 CRUD 的固定層。

- `ViewModel`：畫面顯示或表單輸入的資料，只放該頁需要的欄位
- `Controller`：處理路由、授權、ModelState、HTTP 回應與頁面導向
- `Service`：封裝跨表交易、外部服務、長流程或多處共用規則
- `QmahDbContext`：EF Core 存取 SQL Server 的共同入口，每個 HTTP request 一份
- `Entity`：資料表對照，只在 Controller／未來的 Service 與 EF Core 之間使用

QMAH 不採「每張表一個 Wrapper」、Generic Repository 或「每張表一個 Service」。EF Core 已提供查詢、Change Tracking 與交易；單表 CRUD 再包一層只會增加轉換與除錯位置。

## 與課堂單層 MVC 範例的差異

一般課堂範例可能把全站的 `Controllers`、`Models`、`ViewModels`、`Views` 都放在專案根目錄。這適合單一功能範例；QMAH 則以五個 Area 讓組員分工，但不代表所有 C# Model 都要跟著搬進 Area

```text
課堂單層範例                     QMAH
Controllers/                     Areas/<Area>/Controllers/
Models/                           Models/Entities/、Models/Identity/
ViewModels/                       Areas/<Area>/ViewModels/
Views/                            Areas/<Area>/Views/
DbContext 放在 Models/            Data/QmahDbContext.cs
```

QMAH 的 DB-first Entity、Identity Model 與 `QmahDbContext` 是共用資料契約，保留在 Area 外面。各 Area 分開的是畫面與流程：Controller、ViewModel、View、Area 專用前端檔案，以及真正需要時才建立的 Service

Entity 技術上可以放在其他資料夾，只要 namespace 與編譯引用正確，ASP.NET Core MVC 和 EF Core 仍能使用。但 QMAH 不建議搬移或在 Area 複製 Entity，因為同一個 Entity 可能被多個 Area 關聯查詢，DB-first 對照也包含分散於共用 partial 檔案的 navigation properties。搬移只會增加 namespace、DbContext、關聯與重新 Scaffold 對照時的維護成本

另一個差異是 QMAH 已在 `Program.cs` 以 DI 註冊 scoped `QmahDbContext`。Controller 必須透過建構式注入，不沿用教學範例中每個 Action 自行 `new DbContext()` 的寫法

## Controller 什麼時候直接用 DbContext

單一資料表的列表、詳情、新增、修改與刪除，可由 Controller 直接注入 `QmahDbContext`。

```text
Catalog 分類管理
  → CategoriesController
  → _db.ArtifactCategories
  → SQL Server
```

ASP.NET Core MVC 的官方 EF Core 教學也會在 Controller 注入 DbContext。這適合目前的單表 CRUD，但不是所有規模專案的唯一標準。流程開始跨表、連接外部服務或需要重用時，再加入 Service。

## Service 什麼時候才建立

目前沒有必須在功能開發前預建的 Service。Service 應由具體流程決定名稱、輸入、輸出與交易範圍。

等下面這些功能真的開始做，而且流程本身已經值得獨立閱讀與測試時，再建立對應 Service：

| 功能完成後才考慮的 Service | 為什麼需要 |
| --- | --- |
| 文物上架／下架同步 | 要一起調整圖鑑、題庫與商城的可用狀態；流程確定且需要重用時，再依實際責任命名 Service |
| 結帳 | 同時建立訂單、明細、扣庫存、折價券與點數資料 |
| 付款回呼 | 同時更新付款、訂單與可能的庫存或通知 |
| 遊戲回合結算 | 同時處理答案、投票、獎勵、鑰匙、解鎖與成就 |

符合下列任一條件時即可建立 Service，不必等到出現第二個 Controller：

- 一次操作需在同一交易更新多張表
- 狀態判斷、失敗處理或回復流程已不適合留在 Action
- 需要呼叫金流、Email、檔案儲存或其他外部服務
- 同一規則會由 Controller、背景工作或 API 共用
- 需要不啟動 MVC 就能獨立測試流程

短小且容易閱讀的單表 CRUD 保留在 Controller。不要預先建立沒有呼叫點的介面、Service 或方法。

目前不預先建立文物上下架 Service。真正開始做同步上下架時，先用同一個 scoped `QmahDbContext` 完成查詢、規則檢查與儲存；流程變長、出現第二個呼叫點或需要單元測試時，再依實際責任命名並抽出 Service。

## Entity、ViewModel、DTO 與 Wrapper

| 類別 | 何時建立 | 不該做什麼 |
| --- | --- | --- |
| Entity | 已有，對照 SQL Server 資料表 | 不直接拿來接收 POST 表單或回傳 Razor View |
| ViewModel | 每個 Razor 頁面需要資料或表單時 | 不放資料庫追蹤或商業流程 |
| DTO | 真的開 JSON API、匯入匯出或第三方介接時 | 不取代 Razor ViewModel |

ViewModel 代表一個畫面的輸入或輸出。建立 Edit 頁時，只放 Edit 頁允許顯示或修改的欄位。它不需要與 Entity 一對一，也不需要為資料表所有欄位建立屬性。

如果 `ProductWrapper.Name` 只是讀寫內部 `Product.Name`，Controller 仍要先從 `_db.Products` 取得 Entity，再建立 Wrapper，畫面又要轉成 ViewModel。這種 Wrapper 沒有減少任何查詢、驗證或 mapping，反而形成 `Entity → Wrapper → ViewModel`，因此不納入專案。

只有類別真的需要保護一組不能被繞過的行為，而且無法合理放在既有 Entity、ViewModel 或 Service 時，才考慮 Domain Model 或 Wrapper。例如必須把第三方套件的物件轉成固定介面，但第三方類別本身不能修改；或舊系統物件必須維持相容，同時需要在外層統一新行為。QMAH 的一般 CRUD、跨表結帳與 JSON API 都不符合這個條件：CRUD 直接用 DbContext，結帳使用具體 Service，API 使用 DTO。

不預先建立空的 `ViewModels` 資料夾。第一個頁面開始實作時，在該 Area 建立實際使用的 ViewModel。

## Area 功能完成後的檔案樣貌

正式 Repository 目前只保留五個 Area 的起始結構，不預先放空 Controller、ViewModel、Service 或 View。以下以 Catalog 的「文物管理」為例，說明功能逐步完成後合理的檔案位置：

```text
QMAH.Web/
├─ Data/
│  └─ QmahDbContext.cs                 # 全站共用，不放在 Area
├─ Models/
│  ├─ Entities/
│  │  └─ Artifact.cs                   # DB-first Entity，全站共用，不複製到 Area
│  ├─ Identity/
│  │  └─ ApplicationUser.cs            # ASP.NET Core Identity 使用者
│  └─ (Api)/                           # 日後真的開 JSON API 才建立 DTO
├─ Areas/
│  └─ Catalog/
│     ├─ Controllers/
│     │  └─ ArtifactsController.cs      # 路由、HTTP、ModelState、頁面導向
│     ├─ ViewModels/
│     │  ├─ ArtifactListItemViewModel.cs # Index 每列需要的欄位
│     │  ├─ ArtifactEditViewModel.cs     # Create／Edit 允許輸入的欄位與表單驗證
│     │  └─ ArtifactDetailsViewModel.cs  # Details 需要的欄位與關聯顯示資料
│     ├─ (Services)/
│     │  └─ ArtifactAvailabilityService.cs # 只有真正出現跨表同步流程時才建立
│     └─ Views/
│        └─ Artifacts/
│           ├─ Index.cshtml
│           ├─ Details.cshtml
│           ├─ Create.cshtml
│           ├─ Edit.cshtml
│           └─ (_ArtifactForm.cshtml)    # Create／Edit 欄位重複時才抽 Partial View
└─ wwwroot/
   ├─ (css/areas/catalog.css)            # 只有 Catalog 確實需要的樣式
   └─ (js/areas/catalog.js)              # 只有 Catalog 確實需要的前端行為
```

同一個 Entity 不需要對應一個固定名稱的 ViewModel。畫面需要什麼資料，就建立什麼 ViewModel；例如列表、編輯與詳細頁通常需要不同欄位。Razor View 與新增／修改表單都使用 ViewModel，不把資料庫 Entity 當成畫面契約。

`Services` 與 `Models/Api` 都是「出現實際需求後再建立」的資料夾。這樣從檔案結構即可看出功能目前是否已有跨表流程或 API，而不會留下名稱存在但沒有責任的空類別。

## 資料庫規則放在哪裡

| 規則 | 放置位置 |
| --- | --- |
| 必填、外鍵、唯一值、資料型別、合法狀態值 | SQL Server Schema 與 `database/Schema.sql` |
| 表單必填、長度、格式與友善錯誤訊息 | ViewModel 的 Data Annotations；真的出現大量可重用條件時再統一選擇驗證工具 |
| 需要查資料才能判斷的流程規則 | 短小單表規則放 Controller；跨表、長流程、外部服務或重用規則放 Service |
| 密碼、角色、登入、Token | ASP.NET Core Identity API |

`QmahDbContext.CheckConstraints.cs` 已不保留。資料庫已經真正執行 CHECK constraint，而 QMAH 不用 EF Migration；再在 Fluent mapping 寫一次同樣規則不會多一層保護，只會讓 Schema 修改時多一份要同步。

## Entity 與 DbContext 怎麼產生

QMAH 是 DB-first。SQL Server Schema 定案後，使用 EF Core Scaffold 產生暫存對照，確認 Entity、欄位、索引與關聯有沒有落差。`QmahDbContext` 本身已保留必要 XML 註解，也在 `OnModelCreating` 先呼叫 `base.OnModelCreating(modelBuilder)`，讓 Identity 的標準 mapping 先建立，再加上 QMAH 的 schema 對照。

目前 `Models/Entities` 中有 33 個資料表 Entity 檔案，屬性與基礎 Navigation Property 來自 SQL Server Scaffold 對照，不是依畫面需求自行猜出來的類別。這些 Entity 的用途只有三項：代表資料列、保存外鍵值、提供 EF Core 關聯導覽；不放表單欄位、畫面文字或 Controller 流程。

另外兩個 `partial` 檔案處理 Scaffold 無法直接完成的整合差異：

- `ApplicationUserNavigations.cs`：把各資料表的 `UserId` 外鍵連到現有 `ApplicationUser`，避免再產生一套 `AspNetUser` POCO
- `RelationshipNavigations.cs`：補上文物、回合、解鎖與社群貼文之間可直接查詢的反向關聯

`Models/Identity/ApplicationUser.Relationships.cs` 則保存 Identity 使用者連到各 Area 的反向集合。這三個檔案不代表新資料表，也不會新增欄位；它們只是把 SQL Server 已存在的外鍵完整呈現在 C# 模型中。

```powershell
dotnet tool restore
dotnet ef dbcontext scaffold "<connection string>" Microsoft.EntityFrameworkCore.SqlServer --no-onconfiguring
```

不要把 Scaffold 直接覆蓋到 Repository。原因是 QMAH 使用 ASP.NET Core Identity：原始 Scaffold 會另外產生 `AspNetUser`、`AspNetRole` 等 POCO，和既有的 `ApplicationUser`、`IdentityRole<Guid>` 重複。

正確做法是以 Scaffold 結果當作資料庫對照基準，保留 ASP.NET Core Identity 的標準類別，再把必要的 QMAH 關聯對應回 `QmahDbContext`。這不是手寫猜 Entity；是先由資料庫產生，再處理 Identity 這個框架必要的整合差異。

Scaffold 核對輸出只放工作區 `_工具輸出`，不納入 Repository。

## Area 開發檢查項目

1. 看 Schema／Diagram，確認主鍵、外鍵、唯一限制與 CHECK constraint
2. 在自己的 `Areas/<Area>/ViewModels` 建立該頁需要的 ViewModel
3. Controller 注入 `QmahDbContext`，先做唯讀列表與詳情
4. 再做表單 POST，使用 ViewModel、`ModelState`、Anti-forgery 與 Post/Redirect/Get
5. 跨表交易、長流程、外部服務、重用規則或獨立測試需求出現時新增 Service

完整範例請看[從清單到完整 CRUD](05-crud-tutorial.md)、[Visual Studio Scaffold 操作教學](06-scaffolding-guide.md)與[QmahDbContext 使用手冊](07-dbcontext-usage.md)。
