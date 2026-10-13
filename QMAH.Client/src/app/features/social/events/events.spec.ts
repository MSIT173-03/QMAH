import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { SocialLive } from '../../../core/services/social-live';

import { EventsComponent } from './events';

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;
  let httpMock: HttpTestingController;
  const socialChanges = new Subject<void>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: SocialLive, useValue: { changes: socialChanges } }]
    }).compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // 共用導覽（app-social-shell）會自己取得看板清單
    httpMock.match((r) => r.url.endsWith('/social/boards')).forEach((r) => r.flush([]));
    // 頁面頂端共用的公告主視覺（app-social-spotlight）會取最新公告
    httpMock.match((r) => r.url.endsWith('/social/posts')).forEach((r) => r.flush({ items: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0 }));
    // 精選公告不足時主視覺會再補一次最新貼文，第一批回應後才送出，所以多清一輪
    httpMock.match((r) => r.url.endsWith('/social/posts')).forEach((r) => r.flush({ items: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0 }));
    httpMock.verify();
  });

  it('loads published events from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/social/events'));
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          socialPostId: '22222222-2222-2222-2222-222222222222',
          eventType: 'PLAYER',
          organizerUserId: '33333333-3333-3333-3333-333333333333',
          title: '測試活動',
          content: '活動內容',
          location: '線上',
          latitude: null,
          longitude: null,
          startAt: '2026-01-01T10:00:00Z',
          endAt: '2026-01-01T12:00:00Z',
          registrationEndAt: null,
          capacity: 10,
          registrationCount: 3
        }
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.events.length).toBe(1);
    expect(component.events[0].title).toBe('測試活動');
  });

  it('refreshes event registration counts after a public live update', () => {
    fixture.detectChanges();
    const initial = httpMock.expectOne((r) => r.url.endsWith('/social/events'));
    initial.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });

    socialChanges.next();
    const refresh = httpMock.expectOne((r) => r.url.endsWith('/social/events'));
    refresh.flush({
      items: [{ id: 'event-1', registrationCount: 4 }],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.events[0].registrationCount).toBe(4);
  });

  it('blocks an empty create form on the client without calling the API', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/social/events')).flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });

    component.submitEvent();

    expect(component.createError).toContain('請輸入活動標題');
    expect(component.createError).toContain('請選擇開始時間');
    httpMock.expectNone((r) => r.url.endsWith('/social/events') && r.method === 'POST');
  });

  it('rejects a start time in the past and an end time before the start', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/social/events')).flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });

    component.newEvent = {
      ...component.newEvent,
      title: '測試',
      content: '內容',
      startAt: '2020-01-01T10:00',
      endAt: '2020-01-01T09:00',
      capacity: 0
    };
    component.submitEvent();

    expect(component.createError).toContain('開始時間必須晚於現在');
    expect(component.createError).toContain('結束時間必須晚於開始時間');
    expect(component.createError).toContain('名額上限');
  });
});
