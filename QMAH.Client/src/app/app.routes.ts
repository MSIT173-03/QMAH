import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
// 前台功能依責任建立 lazy loading route，統一由此集中管理。
export const routes: Routes = [
  {
    path: 'artifact-list',
    loadComponent: () => import('./artifact-list/artifact-list').then(m => m.ArtifactList)
  },
    {
    path: 'key-list',
    loadComponent: () => import('./key-list/key-list').then(m => m.KeyList)
  },
];

