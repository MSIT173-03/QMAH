import { Routes } from '@angular/router';

// 前台功能依責任建立 lazy loading route，測試入口獨立掛載，不改變正式首頁行為。
export const routes: Routes = [
  {
    path: 'game/minigames',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/demo',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game/test',
    loadComponent: () =>
      import('./game/game-test.component').then(({ GameTestComponent }) => GameTestComponent)
  }
];
