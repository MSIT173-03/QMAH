import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { EventsComponent } from './events';

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
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
