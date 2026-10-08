import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMegaphone } from '@lucide/angular';

import { SocialApiService, SocialPostListItem } from '../../../core/services/social-api';
import { stripSocialMarkup } from '../../social-markup';
import { QmahIconComponent } from '../qmah-icon/qmah-icon';

/**
 * 公告沒有封面圖時使用的預設主視覺，與商城首頁輪播（store/pages/home/hero-carousel）共用同一組專案內素材
 * （public/images/store/hero，來源與授權見同目錄 attribution.json）。
 */
const ANNOUNCEMENT_FALLBACK_IMAGES = [
  '/images/store/hero/museum-shop-still-life.png',
  '/images/store/hero/gift-wrapping.png',
  '/images/store/hero/museum-shop-shelf.png',
];

/** 換頁時不重抓：第二次進來直接用上一次的公告，版面一開始就是完整的，不會跳動。 */
let cachedAnnouncements: SocialPostListItem[] | null = null;

/**
 * 社群三大頁面（貼文牆、公告、活動）頂端共用的「站方公告」主視覺：可輪播、可摺疊（偏好記在瀏覽器）。
 * 三頁用同一個元件，所以換頁時導覽與內容不會上下跳動；載入中以同高度的骨架佔位。
 */
@Component({
  selector: 'app-social-spotlight',
  imports: [RouterLink, QmahIconComponent, LucideMegaphone],
  templateUrl: './social-spotlight.html',
  styleUrl: './social-spotlight.scss',
})
export class SocialSpotlightComponent implements OnInit, OnDestroy {
  private readonly socialApi = inject(SocialApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  // 貼文牆頂端的公告輪播：只取最新 5 則公告貼文，每 5 秒自動切到下一則。
  announcements: SocialPostListItem[] = [];
  currentAnnouncementIndex = 0;
  /** ui-integration: 公告是 supporting context，收合偏好留在瀏覽器，避免每次進入貼文牆都推開主內容。 */
  announcementCollapsed = signal(false);
  announcementPaused = signal(false);
  /** 與商城輪播一致：提供明確的暫停／播放按鈕，不只依賴滑鼠移入暫停。 */
  announcementAutoplayEnabled = signal(true);
  /** 封面圖載入失敗的公告，改用預設主視覺，避免出現破圖。 */
  private readonly failedAnnouncementImages = new Set<string>();
  private readonly announcementStorageKey = 'qmah.social.announcements.collapsed';
  private announcementTimer?: ReturnType<typeof setInterval>;
  private announcementPointerPaused = false;
  private announcementFocusPaused = false;

  readonly stripMarkup = stripSocialMarkup;
  /** 第一次載入完成前顯示骨架（有快取就不需要） */
  readonly loaded = signal(cachedAnnouncements !== null);

  ngOnInit(): void {
    this.announcementCollapsed.set(this.readAnnouncementCollapsePreference());
    if (cachedAnnouncements) {
      this.announcements = cachedAnnouncements;
      this.syncAnnouncementTimer();
    }
    this.loadAnnouncements();
  }

  ngOnDestroy(): void {
    if (this.announcementTimer) clearInterval(this.announcementTimer);
  }

  private loadAnnouncements(): void {
    this.socialApi.getPosts({ postType: 'ANNOUNCEMENT', pageSize: 5 }).subscribe({
      next: (page) => {
        cachedAnnouncements = page.items;
        this.announcements = page.items;
        if (this.currentAnnouncementIndex >= page.items.length) this.currentAnnouncementIndex = 0;
        this.loaded.set(true);
        this.syncAnnouncementTimer();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loaded.set(true);
        this.cdr.detectChanges();
      }
    });
  }

  private readAnnouncementCollapsePreference(): boolean {
    try {
      return localStorage.getItem(this.announcementStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private syncAnnouncementTimer(): void {
    if (this.announcementTimer) clearInterval(this.announcementTimer);
    this.announcementTimer = undefined;
    this.announcementPaused.set(this.announcementPointerPaused || this.announcementFocusPaused);
    if (
      !this.announcementCollapsed() &&
      !this.announcementPaused() &&
      this.announcementAutoplayEnabled() &&
      !this.prefersReducedMotion() &&
      this.announcements.length > 1
    ) {
      this.announcementTimer = setInterval(() => this.nextAnnouncement(), 4500);
    }
  }

  pauseAnnouncementsForPointer(): void {
    this.announcementPointerPaused = true;
    this.syncAnnouncementTimer();
  }

  resumeAnnouncementsForPointer(): void {
    this.announcementPointerPaused = false;
    this.syncAnnouncementTimer();
  }

  pauseAnnouncementsForFocus(): void {
    this.announcementFocusPaused = true;
    this.syncAnnouncementTimer();
  }

  resumeAnnouncementsForFocus(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    const currentTarget = event.currentTarget;
    if (nextTarget instanceof Node && currentTarget instanceof HTMLElement && currentTarget.contains(nextTarget)) return;
    this.announcementFocusPaused = false;
    this.syncAnnouncementTimer();
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  toggleAnnouncements(): void {
    this.announcementCollapsed.update((collapsed) => !collapsed);
    try {
      localStorage.setItem(this.announcementStorageKey, this.announcementCollapsed() ? '1' : '0');
    } catch {
      // 瀏覽器拒絕儲存時仍保留本次頁面操作，不讓偏好設定影響公告瀏覽。
    }
    this.syncAnnouncementTimer();
  }

  toggleAnnouncementAutoplay(): void {
    this.announcementAutoplayEnabled.update((enabled) => !enabled);
    this.syncAnnouncementTimer();
  }

  /** 有官方封面就用封面；沒有或載入失敗時，依序輪流使用商城的預設主視覺。 */
  announcementImage(announcement: SocialPostListItem, index: number): string {
    if (announcement.coverImageUrl && !this.failedAnnouncementImages.has(announcement.id)) {
      return announcement.coverImageUrl;
    }
    return ANNOUNCEMENT_FALLBACK_IMAGES[index % ANNOUNCEMENT_FALLBACK_IMAGES.length];
  }

  onAnnouncementImageError(announcementId: string): void {
    if (this.failedAnnouncementImages.has(announcementId)) return;
    this.failedAnnouncementImages.add(announcementId);
    this.cdr.detectChanges();
  }

  nextAnnouncement(): void {
    if (this.announcements.length === 0) return;
    this.currentAnnouncementIndex = (this.currentAnnouncementIndex + 1) % this.announcements.length;
    this.cdr.detectChanges();
  }

  goToAnnouncement(index: number): void {
    this.currentAnnouncementIndex = index;
    this.cdr.detectChanges();
  }
}
