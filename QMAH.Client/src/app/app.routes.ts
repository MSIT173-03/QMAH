import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout';

import { PostsComponent } from './features/social/posts/posts';
import { PostDetailComponent } from './features/social/post-detail/post-detail';
import { EventsComponent } from './features/social/events/events';
import { EventDetailComponent } from './features/social/event-detail/event-detail';
import { AnnouncementsComponent } from './features/social/announcements/announcements';
import { AdminEventsComponent } from './features/admin/admin-events/admin-events';
import { AdminReportsComponent } from './features/admin/admin-reports/admin-reports';
import { AdminPostsComponent } from './features/admin/admin-posts/admin-posts';
import { AdminCommentsComponent } from './features/admin/admin-comments/admin-comments';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'social/posts', pathMatch: 'full' },
      { path: 'social/posts', component: PostsComponent },
      { path: 'social/posts/:id', component: PostDetailComponent },
      { path: 'social/events', component: EventsComponent },
      { path: 'social/events/:id', component: EventDetailComponent },
      { path: 'social/announcements', component: AnnouncementsComponent },
      { path: 'admin/events', component: AdminEventsComponent },
      { path: 'admin/reports', component: AdminReportsComponent },
      { path: 'admin/posts', component: AdminPostsComponent },
      { path: 'admin/comments', component: AdminCommentsComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
