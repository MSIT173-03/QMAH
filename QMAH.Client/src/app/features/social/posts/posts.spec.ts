import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { PostsComponent } from './posts';
import { SocialSpotlightComponent } from '../../../shared/components/social-spotlight/social-spotlight';
import { EventListItem, SocialPostListItem } from '../../../core/services/social-api';
import { SocialLive } from '../../../core/services/social-live';

describe('PostsComponent', () => {
  let component: PostsComponent;
  let fixture: ComponentFixture<PostsComponent>;
  let httpMock: HttpTestingController;
  const socialChanges = new Subject<void>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostsComponent],
      // 貼文牆包含 RouterLink；測試環境也要提供最小 Router，才會和正式 App Shell 的 DI 條件一致。
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: SocialLive, useValue: { changes: socialChanges } }]
    }).compileComponents();

    fixture = TestBed.createComponent(PostsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // 公告主視覺補撈最新貼文的請求（精選公告不足時才送出）：不論測試有沒有走到 initializePosts 都清掉
    for (let round = 0; round < 3; round++) {
      httpMock.match((r) => r.url.endsWith('/social/posts') && r.params.get('postType') === 'ANNOUNCEMENT')
        .forEach((req) => req.flush({ items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0 }));
    }
    httpMock.verify();
  });

  function initializePosts(items: SocialPostListItem[] = [], announcements: SocialPostListItem[] = []): void {
    fixture.detectChanges();
    // 公告主視覺在精選公告不足時會再補一次最新貼文（第一批回應後才送出），所以清兩輪
    for (let round = 0; round < 2; round++) {
      httpMock.match(r => r.url.endsWith('/social/posts')).forEach(req => req.flush({
        items: req.request.params.get('postType') === 'ANNOUNCEMENT' ? announcements : items,
        page: 1, pageSize: 20, totalCount: 100, totalPages: 5,
      }));
    }
    httpMock.expectOne(r => r.url.endsWith('/social/boards')).flush([]);
    httpMock.match(r => r.url.endsWith('/social/events')).forEach(req => req.flush({ items: [], totalCount: 0 }));
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({ window: 'WEEK', items: [] });
  }

  it('cancels an older sort request and restores a cached page immediately', () => {
    const recent = { id: 'recent', createdAt: '2026-10-08T00:00:00Z' } as SocialPostListItem;
    initializePosts([recent]);
    component.toggleSort();
    const pending = httpMock.expectOne(r => r.params.get('sort') === 'oldest');
    component.toggleSort();
    expect(pending.cancelled).toBe(true);
    expect(component.posts).toEqual([recent]);
    expect(component.loading).toBe(false);
    httpMock.expectNone(r => r.url.endsWith('/social/posts'));
  });

  it('keeps the two server pages separate and invalidates them when filters change', () => {
    const recent = { id: 'recent', createdAt: '2026-10-08T00:00:00Z' } as SocialPostListItem;
    const old = { id: 'old', createdAt: '2025-01-01T00:00:00Z' } as SocialPostListItem;
    initializePosts([recent]);
    component.toggleSort();
    httpMock.expectOne(r => r.params.get('sort') === 'oldest').flush({ items: [old], totalCount: 100 });
    component.toggleSort();
    expect(component.posts).toEqual([recent]);
    component.toggleSort();
    expect(component.posts).toEqual([old]);
    component.selectBoard('EVENTS');
    httpMock.expectOne(r => r.params.get('boardCode') === 'EVENTS').flush({ items: [], totalCount: 0 });
    component.toggleSort();
    httpMock.expectOne(r => r.params.get('sort') === 'newest' && r.params.get('boardCode') === 'EVENTS').flush({ items: [], totalCount: 0 });
  });

  it('cancels the active post request when leaving the page', () => {
    initializePosts();
    component.loadPosts();
    const pending = httpMock.expectOne(r => r.url.endsWith('/social/posts'));
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
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
    httpMock.match((r) => r.url.endsWith('/social/events')).forEach((r) => r.flush({ items: [], page: 1, pageSize: 3, totalCount: 0 }));
    httpMock.expectOne((r) => r.url.endsWith('/social/posts/popular')).flush({ window: 'WEEK', items: [] });

    expect(component).toBeTruthy();
  });

  it('keeps ordinary posts and store announcements out of the announcement carousel', () => {
    const notice = { id: 'notice', boardCode: 'GENERAL', postType: 'ANNOUNCEMENT', title: '最新公告', contentPreview: '公告內容', createdAt: '2026-10-14T00:00:00Z' } as SocialPostListItem;
    initializePosts([], [notice, { ...notice, id: 'post', postType: 'POST' }, { ...notice, id: 'store', boardCode: 'STORE' }]);
    const spotlight = fixture.debugElement.query(By.directive(SocialSpotlightComponent)).componentInstance as SocialSpotlightComponent;
    expect(spotlight.announcements.map(item => item.id)).toEqual(['notice']);
    httpMock.expectNone(r => r.params.get('postType') === 'POST' && r.params.get('pageSize') !== '20');
  });

  it('shows recent events first and switches to popular posts with the cycle button', () => {
    fixture.detectChanges();
    httpMock.match(r => r.url.endsWith('/social/posts')).forEach(req => req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    httpMock.expectOne(r => r.url.endsWith('/social/boards')).flush([]);
    httpMock.expectOne(r => r.url.endsWith('/social/events')).flush({
      items: [{
        id: 'event-1', socialPostId: null, eventType: 'PLAYER', organizerUserId: 'member-1',
        organizerDisplayName: '測試會員', title: '本週文物交流', content: '', location: '臺北',
        latitude: null, longitude: null, startAt: '2026-10-20T10:00:00Z', endAt: '2026-10-20T12:00:00Z',
        registrationEndAt: null, capacity: 20, registrationCount: 4, coverImageUrl: null
      }]
    });
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({
      window: 'WEEK', items: [{
        id: 'popular-1', boardCode: 'GENERAL', title: '最近熱門的文物討論', createdAt: '2026-10-12T10:00:00Z',
        participantCount: 8, commentCount: 15
      }]
    });
    fixture.detectChanges();

    expect(component.discoveryTab).toBe('events');
    expect(fixture.nativeElement.querySelector('.social-upcoming')?.textContent).toContain('本週文物交流');
    expect(fixture.nativeElement.querySelector('.social-popular')).toBeNull();

    const toggle = fixture.nativeElement.querySelector('.social-discovery__toggle') as HTMLButtonElement | null;
    expect(toggle?.getAttribute('aria-label')).toBe('切換至熱門貼文');
    toggle?.click();
    fixture.detectChanges();

    expect(component.discoveryTab).toBe('popular');
    expect(fixture.nativeElement.querySelector('.social-popular')?.textContent).toContain('最近熱門的文物討論');
    expect(fixture.nativeElement.querySelector('.social-upcoming')).toBeNull();
  });

  it('shows popular posts when there are no upcoming events', () => {
    fixture.detectChanges();
    httpMock.match(r => r.url.endsWith('/social/posts')).forEach(req => req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    httpMock.expectOne(r => r.url.endsWith('/social/boards')).flush([]);
    httpMock.expectOne(r => r.url.endsWith('/social/events')).flush({ items: [], page: 1, pageSize: 2, totalCount: 0, totalPages: 0 });
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({
      window: 'WEEK', items: [{
        id: 'popular-1', boardCode: 'GENERAL', title: '本週熱門貼文', createdAt: '2026-10-12T10:00:00Z',
        participantCount: 8, commentCount: 15
      }]
    });
    fixture.detectChanges();

    expect(component.discoveryTab).toBe('popular');
    expect(fixture.nativeElement.querySelector('.social-popular')?.textContent).toContain('本週熱門貼文');
    expect(fixture.nativeElement.querySelector('.social-discovery__toggle')).toBeNull();
  });

  it('lets members page through popular posts with the arrows', () => {
    fixture.detectChanges();
    httpMock.match(r => r.url.endsWith('/social/posts')).forEach(req => req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    httpMock.expectOne(r => r.url.endsWith('/social/boards')).flush([]);
    httpMock.expectOne(r => r.url.endsWith('/social/events')).flush({ items: [], page: 1, pageSize: 6, totalCount: 0, totalPages: 0 });
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({
      window: 'WEEK', items: [1, 2, 3].map(n => ({
        id: `popular-${n}`, boardCode: 'GENERAL', title: `熱門 ${n}`, createdAt: '2026-10-12T10:00:00Z', participantCount: 0, commentCount: 0
      }))
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const per = component.eventsPerSlide;
    expect(root.querySelectorAll('.social-popular__item').length).toBe(per);
    expect(root.querySelector('.social-popular__facts')).toBeNull();
    const [prev, next] = Array.from(root.querySelectorAll('.social-popular .social-upcoming__arrow')) as HTMLButtonElement[];
    expect(prev.disabled).toBe(true);
    for (let i = 0; i < 3; i++) { next.click(); fixture.detectChanges(); }
    expect(next.disabled).toBe(true);
    expect(root.querySelector('.social-popular__rank')?.textContent?.trim()).toBe(String(3 - ((3 - 1) % per)));
    prev.click(); fixture.detectChanges();
    expect(root.querySelector('.social-popular__rank')?.textContent?.trim()).not.toBeNull();
  });

  it('keeps activity cards manually navigable and links to the full event list', () => {
    fixture.detectChanges();
    httpMock.match(r => r.url.endsWith('/social/posts')).forEach(req => req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    httpMock.expectOne(r => r.url.endsWith('/social/boards')).flush([]);
    const events: EventListItem[] = [1, 2, 3].map(n => ({
      id: `event-${n}`, socialPostId: null, eventType: 'PLAYER', organizerUserId: `member-${n}`,
      organizerDisplayName: '測試會員', title: `交流活動 ${n}`, content: '', location: '臺北', latitude: null, longitude: null,
      startAt: `2026-10-${20 + n}T10:00:00Z`, endAt: `2026-10-${20 + n}T12:00:00Z`,
      registrationEndAt: null, capacity: null, registrationCount: 0, coverImageUrl: null
    }));
    httpMock.expectOne(r => r.url.endsWith('/social/events')).flush({ items: events, page: 1, pageSize: 6, totalCount: 3, totalPages: 1 });
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({ window: 'WEEK', items: [] });
    fixture.detectChanges();

    expect(component.visibleUpcomingEvents.map(event => event.id)).toEqual(['event-1', 'event-2']);
    expect(fixture.nativeElement.querySelector('.social-discovery__all')?.textContent).toContain('全部活動');
    const next = fixture.nativeElement.querySelector('[aria-label="下一組活動"]') as HTMLButtonElement;
    next.click();
    fixture.detectChanges();
    expect(component.visibleUpcomingEvents.map(event => event.id)).toEqual(['event-3']);

    const previous = fixture.nativeElement.querySelector('[aria-label="上一組活動"]') as HTMLButtonElement;
    previous.click();
    fixture.detectChanges();
    expect(component.visibleUpcomingEvents.map(event => event.id)).toEqual(['event-1', 'event-2']);
  });

  it('loads posts from the API on init', () => {
    fixture.detectChanges();

    const postRequests = httpMock.match((r) => r.url.endsWith('/social/posts'));
    expect(postRequests.length).toBe(2);
    const postsRequest = postRequests.find((r) => r.request.params.get('pageSize') === '20');
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
    httpMock.match((r) => r.url.endsWith('/social/events')).forEach((r) => r.flush({ items: [], page: 1, pageSize: 3, totalCount: 0 }));
    httpMock.expectOne((r) => r.url.endsWith('/social/posts/popular')).flush({ window: 'WEEK', items: [] });

    expect(component.posts.length).toBe(1);
    expect(component.posts[0].title).toBe('測試貼文');
  });

  it('removes posts that are no longer public when a live update arrives', () => {
    initializePosts([{ id: 'post-1', createdAt: '2026-10-08T00:00:00Z' } as SocialPostListItem]);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    socialChanges.next();

    httpMock.expectOne(r => r.url.endsWith('/social/posts/visible')).flush([]);
    httpMock.expectOne(r => r.url.endsWith('/social/posts') && r.params.get('postType') === 'POST').flush({
      items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0
    });
    httpMock.expectOne(r => r.url.endsWith('/social/events')).flush({ items: [], page: 1, pageSize: 2, totalCount: 0, totalPages: 0 });
    httpMock.expectOne(r => r.url.endsWith('/social/posts/popular')).flush({ window: 'WEEK', items: [] });

    expect(component.posts).toEqual([]);
    expect(component.totalCount).toBe(0);
  });

  it('ignores the live notification that arrives right after the first load', () => {
    initializePosts([{ id: 'post-1', createdAt: '2026-10-08T00:00:00Z' } as SocialPostListItem]);
    socialChanges.next();

    httpMock.expectNone(r => r.url.endsWith('/social/posts/visible'));
  });

  it('loads ordinary posts by default and recovers a failed board request on page one', () => {
    initializePosts([{ id: 'post-1', createdAt: '2026-10-08T00:00:00Z' } as SocialPostListItem]);
    component.selectBoard('GUIDE');
    httpMock.expectOne(r => r.params.get('boardCode') === 'GUIDE').flush({}, { status: 500, statusText: 'Server Error' });
    expect(component.loadError).toBeTruthy();
    component.liveUpdateNotice = '更新延遲，稍後重試';
    component.retryPosts();
    const retry = httpMock.expectOne(r => r.params.get('boardCode') === 'GUIDE');
    expect(retry.request.params.get('page')).toBe('1');
    retry.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    expect(component.loadError).toBeNull();
    expect(component.liveUpdateNotice).toBe('');
    component.selectBoard('');
    const all = httpMock.expectOne(r => r.url.endsWith('/social/posts'));
    expect(all.request.params.get('postType')).toBe('POST');
    all.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });
});
