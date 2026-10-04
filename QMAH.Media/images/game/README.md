# 遊戲 UI 素材

這個目錄是遊戲素材的唯一來源，包含 UI Pack 圖片、向量、遊戲紋理與字型。

Angular 透過 `QMAH.Client/scripts/link-game-assets.mjs` 建立 `.game-assets` 目錄連結，再打包至 `/assets/game/`。啟動、建置、監看與測試的 npm 命令會自動確認連結，不需要另存一份素材。不要將素材放回 `QMAH.Client/public/assets/game`。

新素材的來源與授權請記錄在此目錄。Adventure 碎片盒使用 `kenney-adventure-tray.json` 與 `kenney-adventure-license.txt`。

按鈕與木框的同形配色版本共用 SVG 幾何，透過 URL 的片段選擇配色。`kenney-buttons.svg` 保留延展填滿，`kenney-button-tones.svg` 保留原比例，`kenney-wood.svg` 提供淺色、深色與邊框版本。兩組按鈕的延展方式不同，請勿直接互換。紙面、碎片盒與卡牌等不同材質仍保留各自素材。

## 介面材質分工

新增素材限四件，來源與切片記錄在 `kenney-interface-materials.json`。牌桌織物、內容紙卡、控制金屬各有不同功能，不以相同框包覆所有內容。金屬角扣用於索引與收納，藍灰面板用於控制與 HUD。紅色按鈕用於離開／取消，勾選標記只輔助文字與選取狀態。配色以 CSS 語意變數提供，不新增同形配色檔。

木框共用向量新增簡化木紋、倒角光影與四角接縫。四種片段仍共用幾何，以 CSS 變數提供淺色／深色配色，沒有新增圖片或使用寫實木材照片。

`ink-key-pattern.svg` 是專案自製的金色回紋幾何圖樣，共用於墨藍原圖底板與進度 HUD。它獨立於 Kenney 素材，不另製淺色／深色版本，透過透明線條平鋪於固定墨藍底色。

`kenney-medal.svg` 取自 Kenney Medals（CC0）的素面獎章，三種金屬配色共用三條原始路徑。用於達標評級與排行榜第一名，不拉伸獎章。來源與修改記錄在 `kenney-medal.json`，原包授權保留在 `kenney-medals-license.txt`。
