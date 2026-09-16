import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

// 正式流程維持單一入口；展示與 API 測試頁只在開發模式載入，避免進入正式路由。
export const routes: Routes = [
  {
    path: 'game/account',
    loadComponent: () =>
      import('./game/game-account.component').then(({ GameAccountComponent }) => GameAccountComponent)
  },
  {
    path: 'game/training',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/minigames',
    loadComponent: () =>
      import('./game/game-training.component').then(({ GameTrainingComponent }) => GameTrainingComponent)
  },
  {
    path: 'game/rooms',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  {
    path: 'game/room/:roomId',
    loadComponent: () =>
      import('./game/game-room.component').then(({ GameRoomComponent }) => GameRoomComponent)
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
  },
  ...(isDevMode()
    ? [
        {
          path: 'game/demo',
          loadComponent: () =>
            import('./game/game-lobby.component').then(({ GameLobbyComponent }) => GameLobbyComponent)
        },
        {
          path: 'game/test',
          loadComponent: () =>
            import('./game/game-test.component').then(({ GameTestComponent }) => GameTestComponent)
        }
      ]
    : [])
];
