import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AnnouncementsComponent } from './announcements';

describe('AnnouncementsComponent', () => {
  let component: AnnouncementsComponent;
  let fixture: ComponentFixture<AnnouncementsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnouncementsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnouncementsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads announcements from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/social/announcements'));
    expect(req.request.method).toBe('GET');
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: '測試公告',
          summary: '摘要',
          content: '完整內容',
          category: 'GENERAL',
          publishAt: null,
          endAt: null,
          userId: '22222222-2222-2222-2222-222222222222',
          displayName: '官方帳號',
          postType: 'ANNOUNCEMENT',
          publisherType: 'OFFICIAL',
          eventId: null,
          createdAt: '2026-01-01T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.announcements.length).toBe(1);
    expect(component.announcements[0].title).toBe('測試公告');
  });
});
