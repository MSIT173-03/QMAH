import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PostDetailComponent } from './post-detail';
import { MeApiService } from '../../../core/services/me-api';

describe('PostDetailComponent', () => {
  let component: PostDetailComponent;
  let fixture: ComponentFixture<PostDetailComponent>;
  let httpMock: HttpTestingController;
  let meApi: MeApiService;

  const postId = '11111111-1111-1111-1111-111111111111';
  const ownerId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    meApi = TestBed.inject(MeApiService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the post and its comments when id is bound', () => {
    fixture.componentRef.setInput('id', postId);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}`));
    expect(req.request.method).toBe('GET');
    req.flush({
      id: postId,
      boardCode: 'GENERAL',
      userId: '22222222-2222-2222-2222-222222222222',
      displayName: '測試會員',
      artifactId: null,
      eventId: null,
      postType: 'POST',
      publisherType: 'COMMUNITY',
      title: '測試貼文',
      content: '完整內容',
      comments: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          postId,
          parentCommentId: null,
          userId: '44444444-4444-4444-4444-444444444444',
          displayName: '留言者',
          content: '第一則留言',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ],
      media: [],
      locationName: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    expect(component.post?.title).toBe('測試貼文');
    expect(component.post?.comments.length).toBe(1);
  });

  it('shows a friendly message when submitting a comment without being logged in', () => {
    fixture.componentRef.setInput('id', postId);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}`)).flush({
      id: postId,
      boardCode: 'GENERAL',
      userId: '22222222-2222-2222-2222-222222222222',
      displayName: null,
      artifactId: null,
      eventId: null,
      postType: 'POST',
      publisherType: 'COMMUNITY',
      title: '測試貼文',
      content: '完整內容',
      comments: [],
      media: [],
      locationName: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    component.newComment.content = '哈囉';
    component.submitComment();

    const req = httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}/comments`));
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.actionError).toBe('請先登入才能留言。');
  });

  it('only shows edit/delete controls to the post owner', () => {
    fixture.componentRef.setInput('id', postId);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}`)).flush({
      id: postId,
      boardCode: 'GENERAL',
      userId: ownerId,
      displayName: '測試會員',
      artifactId: null,
      eventId: null,
      postType: 'POST',
      publisherType: 'COMMUNITY',
      title: '測試貼文',
      content: '完整內容',
      comments: [],
      media: [],
      locationName: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    // 還沒登入／登入的是別人，不是作者本人
    expect(component.isOwnPost(component.post!)).toBe(false);

    meApi.me.set({
      id: ownerId,
      email: 'owner@qmah.local',
      displayName: '作者本人',
      status: 'ACTIVE',
      pointBalance: 0,
      roles: ['User'],
      createdAt: '2026-01-01T00:00:00Z',
      bio: null,
      visibility: 'PRIVATE',
      avatarPath: null
    });

    expect(component.isOwnPost(component.post!)).toBe(true);
  });

  it('deletes the post and navigates back to the list on success', () => {
    fixture.componentRef.setInput('id', postId);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}`)).flush({
      id: postId,
      boardCode: 'GENERAL',
      userId: ownerId,
      displayName: '測試會員',
      artifactId: null,
      eventId: null,
      postType: 'POST',
      publisherType: 'COMMUNITY',
      title: '測試貼文',
      content: '完整內容',
      comments: [],
      media: [],
      locationName: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    });

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    component.deletePost();
    window.confirm = originalConfirm;

    const req = httpMock.expectOne((r) => r.url.endsWith(`/social/posts/${postId}`) && r.method === 'DELETE');
    req.flush(null);
  });
});
