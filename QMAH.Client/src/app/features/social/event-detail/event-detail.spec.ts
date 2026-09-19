import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { EventDetailComponent } from './event-detail';

describe('EventDetailComponent', () => {
  let component: EventDetailComponent;
  let fixture: ComponentFixture<EventDetailComponent>;
  let httpMock: HttpTestingController;

  const eventId = '11111111-1111-1111-1111-111111111111';

  const sampleEvent = {
    id: eventId,
    socialPostId: '22222222-2222-2222-2222-222222222222',
    eventType: 'PLAYER',
    organizerUserId: '33333333-3333-3333-3333-333333333333',
    title: '測試活動',
    content: '活動內容',
    organizerDisplayName: '測試會員',
    // 整合後活動詳情模板會直接讀取 media.length，測試資料需符合正式 API 的完整回應契約。
    media: [],
    location: '線上',
    latitude: null,
    longitude: null,
    startAt: '2026-01-01T10:00:00Z',
    endAt: '2026-01-01T12:00:00Z',
    registrationEndAt: null,
    capacity: 10,
    registrationCount: 3,
    isRegistered: false,
    reviewStatus: null,
    publishStatus: null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(EventDetailComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the event when id is bound', () => {
    fixture.componentRef.setInput('id', eventId);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith(`/social/events/${eventId}`));
    expect(req.request.method).toBe('GET');
    req.flush(sampleEvent);

    expect(component.event?.title).toBe('測試活動');
    expect(component.event?.isRegistered).toBe(false);
  });

  it('shows a friendly message when registering without being logged in', () => {
    fixture.componentRef.setInput('id', eventId);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.endsWith(`/social/events/${eventId}`)).flush(sampleEvent);

    component.register();

    const req = httpMock.expectOne((r) => r.url.endsWith(`/social/events/${eventId}/registration`) && r.method === 'POST');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.actionError).toBe('請先登入才能報名。');
  });
});
