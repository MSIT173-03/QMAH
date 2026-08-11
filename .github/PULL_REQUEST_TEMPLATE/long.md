## 這次完成什麼

-

## 影響範圍

- 系統／Area：
- 資料庫：無／有，請說明
- 共用檔案：無／有，請說明
- 資料工具／輸出：無／有，請說明品質報告位置

## 怎麼確認

1.

## 畫面或結果

需要時附上截圖、網址或操作結果

## 合併前確認

- [ ] 已 Pull 最新的 `develop`
- [ ] 已執行 `dotnet restore --locked-mode`
- [ ] 已執行 `dotnet build QMAH.sln`
- [ ] 已確認主要操作流程
- [ ] 若涉及資料庫，已核對 SQL Server Schema／ERD，沒有新增中途 Migration
- [ ] 若涉及資料匯入，已先完成預檢並保留 `quality-report.json`／`manifest.json`
- [ ] 沒有提交密碼、Token、`.bak`、`bin`、`obj` 或工具輸出
- [ ] 資料庫或共用檔案的修改已通知組員
