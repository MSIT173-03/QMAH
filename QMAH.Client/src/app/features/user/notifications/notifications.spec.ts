import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { MeApiService } from '../../../core/services/me-api';
import { NotificationLive } from '../../../core/services/notification-live';
import { Notifications } from './notifications';

describe('Notifications', () => {
  const changes = new Subject<void>();
  let fixture: ComponentFixture<Notifications>;
  let component: Notifications;
  let http: HttpTestingController;

  const page = {
    items: [{
      id: 'notification-1', title: '新留言', content: '貼文有新留言', targetUrl: null,
      isRead: false, createdAt: '2026-10-13T00:00:00Z', readAt: null
    }],
    page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    unreadCount: 1, readCount: 0, totalNotificationCount: 1
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notifications],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: NotificationLive, useValue: { changes, refresh: vi.fn() } }
      ]
    }).compileComponents();
    TestBed.inject(MeApiService).me.set({
      id: 'member-1', email: 'member@example.com', displayName: '會員', status: 'ACTIVE',
      pointBalance: 0, roles: ['User'], createdAt: '', bio: null, visibility: 'PRIVATE', avatarPath: null
    });
    fixture = TestBed.createComponent(Notifications);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function loadInitialPage(): void {
    fixture.detectChanges();
    http.expectOne(request => request.url.endsWith('/me/notifications')).flush(page);
  }

  it('uses server-side read filters and lets a member set one item unread again', () => {
    loadInitialPage();
    component.selectFilter('READ');
    const readFilter = http.expectOne(request => request.url.endsWith('/me/notifications'));
    expect(readFilter.request.params.get('isRead')).toBe('true');
    readFilter.flush({ ...page, items: [{ ...page.items[0], isRead: true, readAt: '2026-10-13T00:10:00Z' }], unreadCount: 0, readCount: 1 });

    component.markAsUnread({ stopPropagation: vi.fn() } as unknown as MouseEvent, component.notifications[0]);
    const markUnread = http.expectOne(request => request.url.endsWith('/me/notifications/notification-1/unread'));
    expect(markUnread.request.method).toBe('POST');
    markUnread.flush(null);

    expect(component.notifications).toEqual([]);
    expect(component.unreadCount).toBe(1);
    expect(component.readCount).toBe(0);
  });

  it('marks all unread notifications through the member endpoint', () => {
    loadInitialPage();
    component.markAllAsRead();

    const markAll = http.expectOne(request => request.url.endsWith('/me/notifications/read-all'));
    expect(markAll.request.method).toBe('POST');
    markAll.flush(null);

    expect(component.unreadCount).toBe(0);
    expect(component.readCount).toBe(1);
    expect(component.notifications[0].isRead).toBe(true);
  });
});
