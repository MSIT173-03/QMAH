import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminPostsComponent } from './admin-posts';

describe('AdminPostsComponent', () => {
  let component: AdminPostsComponent;
  let fixture: ComponentFixture<AdminPostsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPostsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPostsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads all posts (no filter) from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/posts'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          boardCode: 'GENERAL',
          userId: '22222222-2222-2222-2222-222222222222',
          displayName: '測試會員',
          postType: 'POST',
          publisherType: 'COMMUNITY',
          title: '測試貼文',
          contentPreview: '內容預覽',
          status: 'PUBLISHED',
          commentCount: 2,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 50,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.posts.length).toBe(1);
    expect(component.posts[0].title).toBe('測試貼文');
  });

  it('sends a status update request', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/admin/posts')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });

    component.setStatus('11111111-1111-1111-1111-111111111111', 'HIDDEN');

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/posts/11111111-1111-1111-1111-111111111111/status'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'HIDDEN' });
    req.flush({ message: 'ok', id: '11111111-1111-1111-1111-111111111111', status: 'HIDDEN' });

    httpMock.expectOne((r) => r.url.endsWith('/admin/posts')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });
  });
});
