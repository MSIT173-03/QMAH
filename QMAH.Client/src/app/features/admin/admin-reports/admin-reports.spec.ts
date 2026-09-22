import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminReportsComponent } from './admin-reports';

describe('AdminReportsComponent', () => {
  let component: AdminReportsComponent;
  let fixture: ComponentFixture<AdminReportsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReportsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/admin/reports')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });
    expect(component).toBeTruthy();
  });

  it('loads pending reports from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/reports'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          targetType: 'POST',
          targetId: '22222222-2222-2222-2222-222222222222',
          reason: '不當內容',
          detail: null,
          status: 'PENDING',
          resolution: null,
          reporterUserId: '33333333-3333-3333-3333-333333333333',
          reporterDisplayName: '測試檢舉人',
          createdAt: '2026-01-01T00:00:00Z',
          reviewedAt: null,
          targetTitle: '被檢舉的貼文標題',
          targetContent: '被檢舉的貼文內容',
          targetStatus: 'PUBLISHED'
        }
      ],
      page: 1,
      pageSize: 50,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.reports.length).toBe(1);
    expect(component.reports[0].reason).toBe('不當內容');
  });

  it('applies keyword filter when searching', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/admin/reports')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });

    component.filterKeyword = '垃圾訊息';
    component.loadReports();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/reports'));
    expect(req.request.params.get('q')).toBe('垃圾訊息');
    req.flush({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
  });
});
