# QMAH.Client

Angular 使用者前台的啟動、頁面分層、API 串接、驗證、圖片與地圖規則，參閱 [QMAH-Docs 的 Angular 前端開發指南](https://msit173-03.github.io/QMAH-Docs/frontend/angular-development.html)。

前台只依賴 `QMAH.Api` 公開的 REST API 與 DTO，不直接讀取 Entity、資料表或管理後台 ViewModel。

功能按 Catalog、Game、Social、Store、User 分工，實作時在 `src/app/<domain>/` 建立功能目錄。Component 的 TS／HTML／SCSS 與相關 API service 採 colocation；不預建按程式碼類型分類的空目錄。共用功能有實際需要才抽出，各 Domain 自行加入 lazy routes。
