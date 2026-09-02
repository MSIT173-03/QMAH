# Angular 前端的使用者前台開發起點

`QMAH.Client` 是期末使用者前台的獨立 Angular 21.2.22 前端開發入口。目前已完成可編譯的 standalone 應用程式、Router、HttpClient、環境設定與 API proxy，功能開發順序與資料串接方式集中整理在[期末前端使用者前台開發交接](20-final-frontend-handoff.md)。

## 固定版本

| 工具 | 版本／範圍 |
| --- | --- |
| Angular、Angular CLI、Angular Build | `21.2.22` |
| Node.js | `20.19.0` 以上的 20.x、`22.12.0` 以上的 22.x，或 `24.0.0` 以上 |
| npm | `11.16.0`（`package.json` 與 lockfile 固定的版本） |
| TypeScript | `5.9.3` |
| RxJS | `7.8.2` |

## 為什麼使用 Angular 21.2.22

課堂要求使用 Angular 21，因此版本維持在 21 這個 major version，不升到 Angular 22。原本的 Angular 21.1.3 相依樹在本機 `npm audit` 會列出漏洞；升到目前固定的 21.2.22 後，`npm audit --audit-level=high` 已回報 `found 0 vulnerabilities`。這次只更新 Angular 21 內的次版本與修補版本，standalone、Router、HttpClient、環境設定與 SCSS 的基本寫法不需要改寫。

Angular 官方的版本相容表把 21.0、21.1 與 21.2 放在相同的 Node.js、TypeScript 與 RxJS 相容範圍內；目前專案使用 TypeScript 5.9.3、RxJS 7.8.2，Node.js 以 `package.json` 的 engines 為準。套件版本完整寫死在 `QMAH.Client/package.json` 與 `package-lock.json`，組員不要在各自分支自行升降版本。[Angular 版本相容性](https://angular.dev/reference/versions)／[Angular 版本發布與支援週期](https://angular.dev/reference/releases)

## 第一次使用

在 Repository 根目錄執行：

```powershell
Set-Location .\QMAH.Client
npm ci
```

`npm ci` 會依 lockfile 安裝完全相同的依賴。`node_modules`、`dist` 與 `.angular/cache` 都是本機產物，不提交到 Git。

## 啟動 API 與 Angular

使用者前台開發需要後端 API 主機。可在 Visual Studio 使用雙啟動設定，也可在 VS Code 根目錄的 **Run and Debug** 選擇 `QMAH 使用者前台開發（API 後端＋Angular 前端）`。命令列方式如下：

終端機一：

```powershell
dotnet run --project .\QMAH.Api\QMAH.Api.csproj --launch-profile https
```

終端機二：

```powershell
Set-Location .\QMAH.Client
npm start
```

瀏覽器網址為 `http://localhost:4200/`。`proxy.conf.json` 會把 `/api`、`/openapi` 與 `/scalar` 轉到後端 API `https://localhost:7249`；Angular 前端程式使用 `/api/v1`，不要把 API 連接埠寫死在 component。

Razor 前端管理後台若要一起看，另行啟動 `QMAH.Web` 的 `https` 設定即可。後端 API、Razor 前端管理後台與 Angular 前端共用同一個 SQL Server 資料庫，應用程式啟動不會自動建表或塞資料。

## 建立第一個使用者前台功能

開始實作時依序處理：

1. 先閱讀 [`13-rest-api.md`](13-rest-api.md)，確認 Endpoint、DTO、分頁與錯誤格式。
2. 需要下拉選項時先讀 `/api/v1/metadata`，畫面顯示中文 Label，資料送回 API 才使用 Code。
3. 用 Angular CLI 產生 standalone component、service、guard 或 interceptor。
4. 只把真正完成的功能加入 `src/app/app.routes.ts`，功能路由採 lazy loading。
5. API 寫入前先取得 Anti-forgery Cookie，所有瀏覽器請求保留 Cookie credentials。
6. 同時處理載入中、空資料、401／403、ValidationProblemDetails、網路錯誤與窄螢幕版面。

`app.routes.ts` 是 Angular 前端使用者前台功能路由的集中入口；新增功能時依頁面責任建立 lazy loading 路由，並讓畫面資料來自後端 REST API 契約。

## Cookie 與 Anti-forgery

API 使用 HttpOnly Cookie 保存登入狀態，不把密碼或自製 JWT 放在 localStorage。Angular 前端使用 `HttpClient` 時應保留 credentials；若直接呼叫 API origin，也要確認 CORS 來源在後端 API 設定中明確列出。

第一次進行 POST、PUT 或 DELETE 前呼叫：

```text
GET /api/v1/account/antiforgery-token
```

API 會設定 `XSRF-TOKEN-API` Cookie；後續 unsafe request 帶 `X-XSRF-TOKEN` Header。Angular HttpClient 已透過 `withXsrfConfiguration` 使用這組名稱，不要自行改成把 Token 放在網址或 request body。API 內部的 HttpOnly antiforgery cookie 另使用 `.QMAH.Api.Antiforgery`，前台不需要讀取它。

## VS Code

Repository 提供 `.vscode/launch.json`、`.vscode/tasks.json` 與擴充套件設定。第一次以 VS Code 開啟已信任的 Repository 資料夾時，`folderOpen` 任務會自動補齊必要擴充套件；若 VS Code 工作區信任或公司政策阻擋自動任務，也可以手動執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Install-VSCodeExtensions.ps1
```

腳本會先檢查現有擴充套件，只安裝缺少的項目，不會反覆覆寫或更新版本；它不會改動程式碼或 package.json。`extensions.json` 仍保留建議清單，供未啟用自動任務的環境使用。

## 建置

```powershell
Set-Location .\QMAH.Client
npm run build
npm test -- --watch=false
```

前台頁面開始製作後，建置成功仍要用瀏覽器檢查實際 API、登入、錯誤畫面、鍵盤操作與手機寬度；單純編譯不代表功能完成。
