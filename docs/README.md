# QMAH 文件入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Docs 專案](https://github.com/MSIT173-03/QMAH-Docs) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database) ｜ [QMAH-Docs 文件站](https://msit173-03.github.io/QMAH-Docs/)

正式文件位於 [QMAH-Docs](https://msit173-03.github.io/QMAH-Docs/)。本檔只列出產品程式 Repository 內需要的入口，不在這裡維護第二套文件。

## 目前會員圖鑑 API

會員圖鑑的狀態與歷史由 API 直接提供，前端不需要自行比對 `ArtifactUnlocks`：

- `GET /api/v1/me/catalog/artifacts`：登入後取得啟用文物清單，以及目前會員的 `isUnlocked`、`unlockedAt`；支援 `q`、`categoryCode`、`eraCode`、`page`、`pageSize`。
- `GET /api/v1/me/catalog/unlocks`：登入後取得目前會員的解鎖歷史；支援相同的搜尋與篩選參數，依 `unlockedAt` 最新優先分頁。
- `GET /api/v1/me/economy`：取得各類鑰匙餘額與每把鑰匙的 `eligibleArtifactCount`。
- `POST /api/v1/me/keys/{keyCode}/unlock`：送 `{ "artifactId": "<GUID>" }` 只適用 `UNIVERSAL`；`NORMAL`、`CATEGORY`、`ERA` 不指定目標，由伺服器依鑰匙範圍抽選。

實作位置：`QMAH.Api/Controllers/V1/MemberCatalogController.cs`、`EconomyController.cs`、`ApiDtos.cs`；OpenAPI 的操作與欄位說明位於 `QMAH.Api/Infrastructure/OpenApi`。完整 request、response、錯誤與會員資料保存規則請看 [REST API 契約](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html) 與 [Catalog 圖鑑說明](https://msit173-03.github.io/QMAH-Docs/quick-reference/catalog.html)。

- [QMAH-Docs GitHub](https://github.com/MSIT173-03/QMAH-Docs)
- [開始開發](https://msit173-03.github.io/QMAH-Docs/getting-started/development-environment.html)
- [REST API 契約](https://msit173-03.github.io/QMAH-Docs/reference/rest-api.html)
- [Angular 使用者前台](https://msit173-03.github.io/QMAH-Docs/frontend/angular-development.html)
- [資料庫與資料工具](https://msit173-03.github.io/QMAH-Docs/reference/data-tools.html)
