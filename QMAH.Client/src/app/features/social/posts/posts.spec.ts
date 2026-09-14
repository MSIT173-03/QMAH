import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PostsComponent } from './posts';

describe('PostsComponent', () => {
  let component: PostsComponent;
  let fixture: ComponentFixture<PostsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
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
    httpMock.expectOne((req) => req.url.endsWith('/social/posts')).flush({
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0
    });
    expect(component).toBeTruthy();
  });

  it('loads posts from the API on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/social/posts'));
    expect(req.request.method).toBe('GET');
    req.flush({
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

    expect(component.posts.length).toBe(1);
    expect(component.posts[0].title).toBe('測試貼文');
  });
});
