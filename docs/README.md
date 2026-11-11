# QMAH 文件入口

[QMAH 專案](https://github.com/MSIT173-03/QMAH) ｜ [QMAH-Database 專案](https://github.com/MSIT173-03/QMAH-Database)

本檔列出產品程式 Repository 內的文件入口與 API 摘要。

## 封存、執行與維護

- [主專案與本地啟動](../README.md)：Docker、Visual Studio 與必要服務設定。
- [展示結束與維護狀態](demo-retirement.md)：Azure 免費展示結束、雲端收尾與自行部署。
- [資安維護紀錄](security-maintenance.md)：弱點修補、稽核方式與實際驗證範圍。
- [測試怎麼選](testing.md)：最小風險檢查、測試合併與 CI 分工。
- [隔離壓測](performance.md)：實際基準、查詢改善與容量限制。
- [資安政策](../SECURITY.md)：私下回報方式與對外部署限制。
- [歷史 Azure 部署](https://github.com/MSIT173-03/QMAH/tree/1252a074/deploy/azure-demo)：舊腳本保留於 Git 歷史，不屬於目前版本。
- [第三方登入檢查](external-login-checks.md)、[信箱驗證](email-verification.md)、[會員密碼](member-password.md)。

## 目前會員圖鑑 API

會員圖鑑的狀態與歷史由 API 直接提供，前端不需要自行比對 `ArtifactUnlocks`：

- `GET /api/v1/me/catalog/artifacts`：登入後取得啟用文物清單，以及目前會員的 `isUnlocked`、`unlockedAt`。支援 `q`、`categoryCode`、`eraCode`、`page`、`pageSize`。
- `GET /api/v1/me/catalog/unlocks`：登入後取得目前會員的解鎖歷史。支援相同的搜尋與篩選參數，依 `unlockedAt` 最新優先分頁。
- `GET /api/v1/me/economy`：取得各類鑰匙餘額與每把鑰匙的 `eligibleArtifactCount`。
- `POST /api/v1/me/keys/{keyCode}/unlock`：送 `{ "artifactId": "<GUID>" }` 只適用 `UNIVERSAL`。`NORMAL`、`CATEGORY`、`ERA` 不指定目標，由伺服器依鑰匙範圍抽選。

實作位置：`QMAH.Api/Controllers/V1/MemberCatalogController.cs`、`EconomyController.cs`、`ApiDtos.cs`。OpenAPI 的操作與欄位說明位於 `QMAH.Api/Infrastructure/OpenApi`。完整 request 與 response 以 OpenAPI／Scalar 為準。

- [資料庫](../database/README.md)
- [資料工具](../tools/QmahDataTools/README.md)

## 介面設計基準

- [前台色彩與視覺素材基準](ui-color-system.md)
