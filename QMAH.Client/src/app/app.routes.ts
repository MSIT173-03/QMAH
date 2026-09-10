import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout';

import { PostsComponent } from './features/social/posts/posts';
import { AdminEventsComponent } from './features/admin/admin-events/admin-events';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'social/posts', pathMatch: 'full' },
      { path: 'social/posts', component: PostsComponent },
      { path: 'admin/events', component: AdminEventsComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
