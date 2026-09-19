# 明信片模板交接（Luna）

商品詳情直接重用 `app-collectible-card`，傳入 `[image]`、`[name]`、`[type]`、`[dimensions]`、`[description]`。禁止每件商品複製元件或產生專屬動畫。

- 自然長寬自動選橫式、方形、直式；比例小於 0.65 的長直幅轉 90 度，旋轉前交換顯示尺寸避免留邊。
- 正面以滿版影像直接疊印名稱與類型；背面顯示尺寸、最多 72 字的既有簡述、正式 Logo、郵票框與地址線。
- 方形與直式背面自動改成上下分區；橫式與旋轉長幅維持左右分區，不需替單件商品寫版型條件。
- 共用一張約 4 KB 的紙紋；列表繼續使用縮圖，只有詳情使用此元件。
- 本版為省資源採 CSS 3D，沒有 Three.js、WebGL、持續 requestAnimationFrame 或商品貼圖生成工作。印刷感為紙紋與墨色合成，並非物理材質渲染。
- 翻面軸只設定 transform 與 preserve-3d；不要在軸上加 opacity、filter、overflow:hidden 或固定紙色底板，避免壓平與穿牆。
- 原生 button 支援 Enter／空白鍵，降低動態偏好會停用轉場。修改後跑 npm run build，並檢視正面、背面及翻轉中段。

2026-09-19：已通過 Angular production build，預覽已檢視翻轉中段。精細印刷材質與跨瀏覽器視覺驗收仍可在同一元件集中調整。
