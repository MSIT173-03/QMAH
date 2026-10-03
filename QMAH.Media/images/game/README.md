# 遊戲 UI 素材

這個目錄是遊戲素材的唯一來源，包含 UI Pack 圖片、向量、遊戲紋理與字型。

Angular 透過 `QMAH.Client/scripts/link-game-assets.mjs` 建立 `.game-assets` 目錄連結，再打包至 `/assets/game/`。啟動、建置、監看與測試的 npm 命令會自動確認連結，不需要另存一份素材。不要將素材放回 `QMAH.Client/public/assets/game`。

新素材的來源與授權請記錄在此目錄。Adventure 碎片盒使用 `kenney-adventure-tray.json` 與 `kenney-adventure-license.txt`。
