import { Routes } from '@angular/router';

// 前台功能依責任建立 lazy loading route，統一由此集中管理。
export const routes: Routes = [
  {
    path: 'artifact-list',
    loadComponent: () => import('./artifact-list/artifact-list').then(m => m.ArtifactList)
  },
]
