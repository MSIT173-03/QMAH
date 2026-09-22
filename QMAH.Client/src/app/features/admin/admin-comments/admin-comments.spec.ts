import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminCommentsComponent } from './admin-comments';

describe('AdminCommentsComponent', () => {
  let component: AdminCommentsComponent;
  let fixture: ComponentFixture<AdminCommentsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCommentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCommentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads all comments (no filter) from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/comments'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          postId: '22222222-2222-2222-2222-222222222222',
          postTitle: '測試貼文',
          parentCommentId: null,
          userId: '33333333-3333-3333-3333-333333333333',
          displayName: '留言者',
          content: '測試留言',
          status: 'PUBLISHED',
          createdAt: '2026-01-01T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 50,
      totalCount: 1,
      totalPages: 1
    });

    expect(component.comments.length).toBe(1);
    expect(component.comments[0].content).toBe('測試留言');
  });

  it('sends a status update request', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/admin/comments')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });

    component.setStatus('11111111-1111-1111-1111-111111111111', 'DELETED');

    const req = httpMock.expectOne((r) => r.url.endsWith('/admin/comments/11111111-1111-1111-1111-111111111111/status'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: 'DELETED' });
    req.flush({ message: 'ok', id: '11111111-1111-1111-1111-111111111111', status: 'DELETED' });

    httpMock.expectOne((r) => r.url.endsWith('/admin/comments')).flush({
      items: [],
      page: 1,
      pageSize: 50,
      totalCount: 0,
      totalPages: 0
    });
  });
});
