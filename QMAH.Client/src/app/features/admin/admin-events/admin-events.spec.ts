import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminEventsComponent } from './admin-events';

describe('AdminEventsComponent', () => {
  let component: AdminEventsComponent;
  let fixture: ComponentFixture<AdminEventsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEventsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEventsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/admin/events')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });
    expect(component).toBeTruthy();
  });

  it('loads all events (no filter) from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/events'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('reviewStatus')).toBe(false);
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          eventType: 'PLAYER',
          organizerUserId: '22222222-2222-2222-2222-222222222222',
          organizerDisplayName: '測試發起人',
          title: '測試活動',
          startAt: '2026-01-01T00:00:00Z',
          endAt: '2026-01-01T02:00:00Z',
          reviewStatus: 'PENDING',
          publishStatus: 'DRAFT',
          reviewNote: null,
          createdAt: '2026-01-01T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 50,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.events.length).toBe(1);
    expect(component.events[0].title).toBe('測試活動');
  });

  it('applies filters when searching', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/admin/events')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });

    component.filterReviewStatus = 'APPROVED';
    component.filterKeyword = '測試';
    component.loadEvents();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/events'));
    expect(req.request.params.get('reviewStatus')).toBe('APPROVED');
    expect(req.request.params.get('q')).toBe('測試');
    req.flush({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
  });
});
