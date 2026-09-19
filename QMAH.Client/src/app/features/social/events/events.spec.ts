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
});
