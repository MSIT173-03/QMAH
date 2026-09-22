import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { NotificationsBellComponent } from './notifications-bell';

describe('NotificationsBellComponent', () => {
  let component: NotificationsBellComponent;
  let fixture: ComponentFixture<NotificationsBellComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsBellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsBellComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // 元件內有 setInterval 輪詢，測試結束要銷毀元件觸發 ngOnDestroy 清掉計時器，
    // 避免計時器在測試結束後還存在、干擾到下一個測試檔案的 HttpTestingController。
    fixture.destroy();
    httpMock.verify();
  });

  it('hides itself when the visitor is not logged in (401)', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/me/notifications'));
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.loggedIn).toBe(false);
    expect(component.notifications.length).toBe(0);
  });

  it('loads notifications and computes unread count', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/me/notifications'));
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: '貼文有新留言',
          content: '你的貼文有新的留言',
          targetUrl: '/social/posts/22222222-2222-2222-2222-222222222222',
          isRead: false,
          createdAt: '2026-01-01T00:00:00Z',
          readAt: null
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          title: '活動報名成功',
          content: '你已成功報名',
          targetUrl: null,
          isRead: true,
          createdAt: '2026-01-01T00:00:00Z',
          readAt: '2026-01-01T01:00:00Z'
        }
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1
    });

    expect(component.loggedIn).toBe(true);
    expect(component.notifications.length).toBe(2);
    expect(component.unreadCount).toBe(1);
  });

  it('marks a notification as read', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me/notifications')).flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: '貼文有新留言',
          content: '內容',
          targetUrl: null,
          isRead: false,
          createdAt: '2026-01-01T00:00:00Z',
          readAt: null
        }
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1
    });

    component.markRead(component.notifications[0]);

    const req = httpMock.expectOne((r) => r.url.endsWith('/me/notifications/11111111-1111-1111-1111-111111111111/read'));
    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(component.notifications[0].isRead).toBe(true);
  });
});
