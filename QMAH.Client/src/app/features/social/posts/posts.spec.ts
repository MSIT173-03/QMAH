import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PostsComponent } from './posts';

describe('PostsComponent', () => {
  let component: PostsComponent;
  let fixture: ComponentFixture<PostsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostsComponent],
      // 貼文牆包含 RouterLink；測試環境也要提供最小 Router，才會和正式 App Shell 的 DI 條件一致。
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PostsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();

    // 整合後貼文牆初始化會同時載入一般貼文、公告輪播與看板清單，測試需把三個既有請求都完成，避免留下未處理的非同步請求。
    httpMock.match((req) => req.url.endsWith('/social/posts')).forEach((req) => req.flush({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0
    }));
    httpMock.expectOne((req) => req.url.endsWith('/social/boards')).flush([]);

    expect(component).toBeTruthy();
  });

  it('loads posts from the API on init', () => {
    fixture.detectChanges();

    const postRequests = httpMock.match((r) => r.url.endsWith('/social/posts'));
    expect(postRequests.length).toBe(2);
    const postsRequest = postRequests.find((r) => !r.request.params.has('postType'));
    const announcementsRequest = postRequests.find((r) => r.request.params.get('postType') === 'ANNOUNCEMENT');
    expect(postsRequest).toBeDefined();
    expect(announcementsRequest).toBeDefined();
    expect(postsRequest!.request.method).toBe('GET');
    postsRequest!.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          boardCode: 'GENERAL',
          userId: '22222222-2222-2222-2222-222222222222',
          displayName: '測試會員',
          artifactId: null,
          eventId: null,
          postType: 'POST',
          publisherType: 'COMMUNITY',
          title: '測試貼文',
          contentPreview: '內容預覽',
          commentCount: 0,
          mediaCount: 0,
          locationName: null,
          latitude: null,
          longitude: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1
    });
    announcementsRequest!.flush({
      items: [],
      page: 1,
      pageSize: 5,
      totalCount: 0,
      totalPages: 0
    });
    httpMock.expectOne((r) => r.url.endsWith('/social/boards')).flush([]);

    expect(component.posts.length).toBe(1);
    expect(component.posts[0].title).toBe('測試貼文');
  });
});
