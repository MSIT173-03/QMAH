# QMAH Angular 前台骨架

這是 QMAH 的 Angular 21.2.22 前台起始專案。目前只建立可編譯的 standalone 應用程式、Router、HttpClient、環境設定與 API proxy，尚未加入任何前台功能頁面。

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

前台開發通常需要 API 同時啟動。根目錄 VS Code 的 **Run and Debug** 已提供 `QMAH 前台開發（API＋Angular）`；也可以分別執行：

```powershell
dotnet run --project ..\QMAH.Api\QMAH.Api.csproj --launch-profile https
npm start
```

瀏覽器開啟 `http://localhost:4200/`。`/api`、`/openapi` 與 `/scalar` 會由 `proxy.conf.json` 轉送到 API 開發主機，因此 Angular 程式不需要寫死跨來源網址。

## 開始新增前台功能

Angular 固定在 21.2.22，是因為課堂要求 Angular 21，而原本 21.1.3 的相依樹在本機安全檢查會列出漏洞；升級後目前 `npm audit --audit-level=high` 為 `found 0 vulnerabilities`。這次沒有跨到 Angular 22，既有 standalone、Router、HttpClient 與 SCSS 寫法可以直接沿用。

1. 先看根目錄 [`docs/12-frontend-start-guide.md`](../docs/12-frontend-start-guide.md) 的路由、環境與驗證流程。
2. 依 [`docs/13-rest-api.md`](../docs/13-rest-api.md) 使用 API DTO，不直接猜資料表欄位。
3. 使用 Angular CLI 產生 standalone component、service 或 guard，再補上實際需求。
4. 每個功能完成後才加入 lazy route；不要預先建立空白頁面或複製 Razor View。

目前 `src/app/app.routes.ts` 保持空白是刻意的，代表尚未開始前台頁面製作。API、Razor 後台與資料庫契約已可先獨立驗證。

## 建置與測試

```powershell
npm run build
npm test -- --watch=false
```

產物 `dist/`、`.angular/cache/`、`node_modules/` 都是本機輸出，不要提交到 Repository。
