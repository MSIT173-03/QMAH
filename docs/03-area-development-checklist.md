# 五個 Area 開發前檢查與執行界線

`Catalog`、`Game`、`Social`、`User`、`Store` 共用以下開發檢查表。

每開始一個頁面或流程，先確認三件事：

1. 這個功能讀取或修改哪一份資料
2. 哪些人可以查看或修改
3. 這筆資料之後是否仍要保留成歷史

資料庫結構以 SQL Server 為準，程式以既有 Entity、`QmahDbContext` 與 Identity 對照。資料表、`QmahDbContext` 與 CRUD 細節仍以各自文件為準；本表只規定開發順序、資料責任與跨 Area 的修改界線。

## 共用開發順序

### 開始前一定先做

- 從最新 `develop` 建立或更新自己的 `feature/<area>` 分支
- 從最新 Release 還原 `QMAH-<version>.bak`，或在 SSMS 執行 `database/QMAH.sql`，確認網站能啟動，並先完成一次 Build
- 閱讀該功能使用的 Entity、`DbSet`、外鍵、唯一索引、`CHECK`、`NOT NULL`、Default 與 `rowversion`
- 先決定這個頁面是清單、詳細資料、新增、編輯、狀態操作，還是跨表流程
- 列出 ViewModel 允許輸入的欄位，不把 Entity 全部直接當成表單模型
- 先在 Controller 或 Action 加上 `[Authorize]`；登入頁和確實需要公開的 Action 才使用 `[AllowAnonymous]`
- 清單與詳細頁先完成正常資料、空資料、查無資料與未授權情況
- 查詢使用注入的 scoped `QmahDbContext`，唯讀查詢使用 `AsNoTracking()`；POST 查回受追蹤 Entity 後逐欄更新
- 寫入前檢查 ModelState、外鍵、唯一值、狀態轉換與資料庫限制，成功後使用 Post/Redirect/Get
- 測試不存在的 Id、重複值、錯誤輸入、未登入、非管理員、外鍵限制和重新整理 POST
- PR 說明列出使用的資料表、路由、共用檔案、是否有跨表寫入，以及實際驗證方式

### 目前一定不要先做

- 不建立第二個資料庫、第二個 `QmahDbContext`、Migration、`Database.Migrate()` 或 `EnsureCreated()`
- 不自行建立 SQL 連線，不使用 `new QmahDbContext()`
- 不把 EF Entity 直接交給 View 或當作可任意修改的 POST Model
- 不為每張表先建立 Wrapper、Generic Repository 或空白 Service；只有跨表流程、重複商業規則或需要封裝外部物件時才建立具體類別
- 不直接寫入 `AspNetUsers`、`AspNetRoles`、`AspNetUserRoles`、`PasswordHash`、Token 或 Claim；帳號與角色使用 Identity API
- 不只在 View 隱藏按鈕就當成授權，Controller 或 Action 必須實際套用 `[Authorize]`
- 不相信表單送回的 `UserId`、權限、價格、訂單金額、庫存、狀態或外鍵；需要的值由登入身分、資料庫或伺服器規則決定
- 不直接刪除訂單、付款、點數流水、遊戲回合、作答、投票、檢舉或已有關聯的文物；使用取消、隱藏、停用或封存
- 不在 View 的迴圈裡逐筆查詢資料庫，也不為了顯示欄位一次 `Include` 所有導覽屬性
- 不在未確認需求前加入第三方登入、金流正式串接、SignalR、背景工作或新的前端框架
- 不直接修改 `Program.cs`、`QmahDbContext`、共用 Layout、Schema 或套件版本而沒有在 PR 說明影響範圍

## 共用資料存取規則

Controller 透過建構式取得 `QmahDbContext`。`DbContext` 是同一個 HTTP request 內的資料工作單位，不是每個 Action 都要自行建立的連線。

```csharp
public sealed class ItemsController : Controller
{
    private readonly QmahDbContext _db;

    public ItemsController(QmahDbContext db)
    {
        _db = db;
    }
}
```

一般清單：

```csharp
var rows = await _db.Products
    .AsNoTracking()
    .OrderBy(product => product.Name)
    .Select(product => new ProductListItemViewModel
    {
        Id = product.Id,
        Name = product.Name,
        Price = product.Price,
        IsActive = product.IsActive
    })
    .ToListAsync(cancellationToken);
```

一般修改：

```csharp
var product = await _db.Products
    .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);

if (product is null)
{
    return NotFound();
}

product.Name = input.Name.Trim();
product.UpdatedAt = DateTime.UtcNow;
await _db.SaveChangesAsync(cancellationToken);
```

查詢用 ViewModel 或投影，寫入用受追蹤 Entity。`SaveChangesAsync` 之前不要把資料庫產生的時間、`rowversion`、外鍵或歷史快照交給表單決定。

## Catalog 圖鑑與資料解鎖

### 開發中可能遇到的事情

- 文物名稱、原始年代或來源文字可能缺漏或無法辨識，原始資料要保留，不要為了畫面好看自行猜測
- `Artifacts` 以 `CategoryId`、`EraBucketId` 連到分類和年代；題庫與商城商品則用 `ArtifactId` 對應同一件文物
- 文物圖片、來源網址、授權代碼與 `AttributionText` 是資料來源的一部分，不能在 CRUD 中隨意改成其他商城素材
- 題庫是一件文物一筆設定，難度限制為 1 至 5；是否啟用要和文物是否可出題的規則一起檢查
- 鑰匙定義可能是一般、分類、年代或通用範圍，範圍欄位和對應的 Category／Era 不能互相矛盾
- `ArtifactUnlocks`、遊戲回合與商城商品都可能引用文物

### 開始前一定先做

- 先完成文物清單和詳細頁，再決定哪些欄位可由後台編輯
- 題庫編輯頁用 `ArtifactId` 選擇既有文物，不用文物名稱比對
- 顯示分類、年代和圖片時使用 `Include` 或投影，不在 View 重新查資料
- 修改分類或年代前，先查是否有文物、鑰匙、題庫或價格規則引用
- 解鎖、題庫設定和圖片來源的修改要記錄實際影響範圍

### 目前一定不要先做

- 不刪除已被題庫、商品、遊戲回合或解鎖資料引用的文物
- 不用商品名稱、圖片檔名或拆解字串找回 `ArtifactId`
- 不把原始授權文字改寫成自訂宣稱，也不把來源商城圖片直接放入公開 Repository
- 不在 Catalog Controller 內直接修改 Store 商品價格、Game 題目或 Social 貼文
- 不為了增加資料量而重新分類、重編 ArtifactRef 或覆蓋原始匯入資料

## Game 遊戲後台

### 開發中可能遇到的事情

- 房間、玩家、回合、作答和投票是一條歷史流程，不是五組互不相關的單表 CRUD
- `GameRoom` 的狀態是 `WAITING`、`PLAYING`、`COMPLETED`、`CANCELLED`，狀態會影響時間欄位
- 私人房間必須有密碼雜湊，公開房間不能保留房間密碼；房間人數、回合數、作答時間和投票時間都有資料庫範圍
- `GameRoom`、`GamePlayer`、`GameRound`、`RoundAnswer`、`Vote` 都有 `RowVersion`；多人同時修改時可能發生並行更新
- 回合結算會同時處理作答、投票、分數或解鎖，是跨表交易，不適合拆成多個互不相關的 SaveChanges

### 開始前一定先做

- 先定義房間狀態轉換和每個狀態可修改的欄位
- 先做管理用的房間、回合和玩家清單與詳細頁，確認時間欄位和關聯能正確顯示
- 修改房間、回合或玩家時帶回 `RowVersion`，捕捉 `DbUpdateConcurrencyException`
- 由登入者或既有 GamePlayer 決定 UserId，不接受表單自行指定其他玩家
- 結算流程使用同一個 scoped `DbContext` 和交易，成功或失敗要能整體回復

### 目前一定不要先做

- 不把已完成房間、回合、作答或投票當成可任意刪除的 CRUD 資料
- 不讓前端決定答案是否正確、回合是否結算或玩家是否是 Host
- 不用每次輪詢都建立新的 `DbContext`，也不把 `RowVersion` 當成一般可編輯欄位
- 不在未決定即時需求前先加入 SignalR、背景服務或複雜計分 Service
- 不修改已完成回合的文物指向來重用歷史資料

## Social 社群與內容管理

### 開發中可能遇到的事情

- 貼文和留言有 `PUBLISHED`、`HIDDEN`、`DELETED` 狀態，檢舉有 `PENDING`、`RESOLVED`、`REJECTED` 狀態
- 留言有自我外鍵 `ParentCommentId`，刪除或隱藏父留言時要考慮子留言
- `ContentReports` 使用 `TargetType`＋`TargetId` 表示貼文或留言，資料庫無法用單一外鍵替這種多型目標保證存在，因此查詢和處理時要自行驗證目標
- 活動同時有審核狀態、發布狀態、開始結束時間、報名截止時間和人數上限
- 通知屬於特定會員，已讀狀態不能由其他會員任意修改

### 開始前一定先做

- 先區分「內容作者可修改」和「管理員可審核／隱藏」的 Action
- 檢舉詳細頁同時顯示目標內容、檢舉理由、處理人和處理時間
- 活動表單先驗證 `EndAt > StartAt`、報名截止時間和容量，再處理報名人數
- 貼文（含官方公告類型）、留言和活動清單預設只顯示符合目前發布狀態的資料
- 通知查詢以目前登入者的 UserId 為條件，更新已讀時只更新自己的通知

### 目前一定不要先做

- 不讓會員修改別人的貼文、留言、檢舉結果或通知
- 不用實體刪除取代貼文和留言的隱藏／刪除狀態
- 不把 `TargetId` 當成可信資料直接更新，必須依 `TargetType` 查驗貼文或留言
- 不在未完成審核規則前讓所有活動直接變成已發布
- 不為了做留言樹一次載入所有留言；先限制頁面範圍、排序與分頁

## User 會員與 Identity

### 開發中可能遇到的事情

- Identity 帳號和 QMAH 會員資料是兩個責任範圍
- Email、密碼、鎖定、角色、登入與 Token 使用 `UserManager`、`SignInManager`、`RoleManager`
- 暱稱、簡介、地址、通知、成就等網站資料使用 `QmahDbContext`
- `UserProfile` 和 `UserAddress` 有 `RowVersion`；地址還有每位會員只能有一個預設地址的唯一規則
- 未登入者不能查看需要會員身分的後台，管理功能需要 `[Authorize(Roles = "Admin")]`

### 開始前一定先做

- 先把 Login、Logout、AccessDenied 的路由和 `[AllowAnonymous]` 界線確認好
- 會員清單透過 `UserManager<ApplicationUser>` 取得帳號資訊，再以 UserId 查詢 Profile 或地址
- Profile、地址與通知表單使用自己的 ViewModel，不把 `ApplicationUser` 或 Identity 內部欄位交給表單
- 編輯目前會員資料時，UserId 由登入 Cookie 取得；管理員編輯其他會員時，Id 由路由查回並再次確認權限
- 帳號停用使用 Identity lockout API；修改 Email 或密碼使用 Identity API

### 目前一定不要先做

- 不直接對 `AspNetUsers.PasswordHash`、`AspNetUserRoles`、`AspNetUserLogins` 或 `AspNetUserTokens` 做一般 CRUD
- 不新增 `GoogleId`、`MicrosoftId` 等供應商專用欄位來預留第三方登入
- 不用 Email、暱稱或表單文字代替 UserId
- 不讓使用者自行送出另一個 UserId 來讀取或修改私人資料
- 不把會員帳號直接實體刪除來取代停用或鎖定

## Store 商城與訂單

### 開發中可能遇到的事情

- `Product` 可用 `ArtifactId` 對應圖鑑文物，但商品自己的名稱、說明、尺寸、價格、庫存和上下架狀態獨立保存
- 購物車同一位會員不能重複建立同一商品列，數量限制為 1 至 99
- 訂單金額、折扣、點數和明細總額有資料庫限制；訂單明細要保存成交當下的品名和單價快照
- 訂單狀態是 `PENDING_PAYMENT`、`PAID`、`FULFILLING`、`SHIPPED`、`COMPLETED`、`CANCELLED`
- 付款狀態是 `PENDING`、`PAID`、`FAILED`、`CANCELLED`，同一張訂單目前只有一筆付款紀錄
- 商品、訂單、付款、優惠券、庫存和點數的寫入常會跨表，不能把每一步當成互不相關的 CRUD

### 開始前一定先做

- 商品清單先區分啟用／停用、庫存和是否已有訂單引用
- 結帳前由伺服器重新查商品價格、庫存、優惠券和點數，不使用瀏覽器送回的總金額
- 建立訂單時同一個流程完成明細快照、金額計算、優惠券使用、庫存與點數異動，必要時使用交易
- 付款回呼以 `MerchantTradeNo` 和合法回傳資料查找付款，重複通知不能重複扣庫存或點數
- 訂單詳細頁顯示快照欄位，不能因商品後續改名或改價而改寫歷史訂單

### 目前一定不要先做

- 不讓前端直接提交訂單狀態、付款狀態、價格、折扣、庫存或點數餘額
- 不修改已有訂單明細的成交品名、單價和數量來同步目前商品
- 不刪除已有訂單、付款、點數交易或已使用優惠券
- 不把付款回呼當成一般表單；必須驗證交易編號、金額、回傳代碼和目前狀態，並讓處理可重複執行
- 不把來源商城圖片或未明確授權的素材加入公開 Repository
- 不在尚未決定正式金流前加入正式商店流程、退款系統或真實付款資料

## 跨 Area 的資料界線

| 共用資料 | 主要負責 Area | 其他 Area 的使用方式 |
| --- | --- | --- |
| 文物、分類、年代、圖片與授權 | `Catalog` | 以 `ArtifactId` 唯讀查詢或建立明確的跨表流程 |
| 題庫與遊戲歷史 | `Game` | `Catalog` 提供可出題文物，不直接修改回合與作答 |
| 會員身分與角色 | `User`／Identity | 其他 Area 使用 `UserManager` 或目前登入者，不直接寫 Identity 表 |
| 商品與訂單歷史 | `Store` | `Catalog` 提供文物對應，其他 Area 不改訂單與付款 |
| 貼文、活動與檢舉 | `Social` | 其他 Area 只建立必要連結，不直接修改社群審核狀態 |

跨 Area 只要同一個操作會寫入兩張以上的表，就先在 PR 說明交易範圍和失敗時的回復方式。單純顯示關聯資料可以直接由同一個 `QmahDbContext` 查詢，不需要為了跨 Area 立刻建立 Wrapper 或通用 Service。

## 完成前共同檢查

- [ ] 未登入者無法直接輸入網址進入受保護頁面
- [ ] 一般 User 無法進入 Admin 限定 Action
- [ ] List、Details、Create、Edit、Delete 或狀態操作的責任清楚
- [ ] View 使用 ViewModel，沒有把密碼、角色、Token 或其他 Identity 內部欄位交給表單；`RowVersion` 只作並行更新檢查
- [ ] 清單使用 `AsNoTracking()`，POST 使用受追蹤 Entity
- [ ] 唯一索引、外鍵、CHECK 和 `rowversion` 錯誤都有可理解的處理方式
- [ ] 歷史資料沒有被實體刪除或被目前資料覆蓋
- [ ] 跨表寫入使用同一個 DbContext，必要時使用交易
- [ ] 有正常、空資料、查無資料、錯誤輸入和重複送出的測試
- [ ] `dotnet restore --locked-mode`、Release Build 和瀏覽器基本流程都通過
