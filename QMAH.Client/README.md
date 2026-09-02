# QMAH Angular 前端使用者前台開發入口

這是 QMAH 的 Angular 21.2.22 前端使用者前台開發入口，已配置可編譯的 standalone 應用程式、Router、HttpClient、環境設定與 API proxy。使用者前台功能依後端 API 契約與期末前台交接文件逐項加入。

## 開發環境

- Node.js：`20.19.0` 以上的 20.x、`22.12.0` 以上的 22.x，或 `24.0.0` 以上
- npm：`11.16.0`（`package.json` 與 lockfile 固定的版本）
- Angular：全套固定為 `21.2.22`
- TypeScript：`5.9.3`；這是目前 Angular 21.2.22 使用的版本

先在這個資料夾執行：

```powershell
npm ci
```

`package.json` 的 `allowScripts` 只核准 Angular 建置流程目前需要的 4 個套件，並鎖定實際安裝版本。這項設定會讓每位組員執行 `npm ci` 時得到相同結果，也保留 npm 對其他安裝腳本的預設限制。若日後升級套件後再次出現警告，先確認來源與用途，再逐一核准；不要改成允許所有安裝腳本。

## 啟動方式

使用者前台開發通常需要後端 API 同時啟動。根目錄 VS Code 的 **Run and Debug** 已提供 `QMAH 使用者前台開發（API 後端＋Angular 前端）`；也可以分別執行：

```powershell
dotnet run --project ..\QMAH.Api\QMAH.Api.csproj --launch-profile https
npm start
```

瀏覽器開啟 `http://localhost:4200/`。`/api`、`/openapi` 與 `/scalar` 會由 `proxy.conf.json` 轉送到 API 開發主機，因此 Angular 程式不需要寫死跨來源網址。

## 開始新增使用者前台功能

Angular 固定在 21.2.22，是因為課堂要求 Angular 21，而原本 21.1.3 的相依樹在本機安全檢查會列出漏洞；升級後目前 `npm audit --audit-level=high` 為 `found 0 vulnerabilities`。這次沒有跨到 Angular 22，既有 standalone、Router、HttpClient 與 SCSS 寫法可以直接沿用。

1. 先看根目錄 [`docs/12-frontend-start-guide.md`](../docs/12-frontend-start-guide.md) 的路由、環境與驗證流程。
2. 依 [`docs/13-rest-api.md`](../docs/13-rest-api.md) 使用 API DTO，不直接猜資料表欄位。
3. 使用 Angular CLI 產生 standalone component、service 或 guard，再補上實際需求。
4. 每個功能以自己的 lazy route、standalone component、service 與 model 組成；Angular 與 Razor 各自維護畫面，資料則共用 API 契約。

`src/app/app.routes.ts` 是功能路由集中入口；加入功能時依頁面責任建立 lazy loading 路由，並由 service 集中處理 API 呼叫與錯誤狀態。

## 建置與測試

```powershell
npm run build
npm test -- --watch=false
```

產物 `dist/`、`.angular/cache/`、`node_modules/` 都是本機輸出，不要提交到 Repository。
