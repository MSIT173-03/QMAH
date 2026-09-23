import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SiteTheme, ThemeService } from '../../../core/services/theme';
import { environment } from '../../../../environments/environment';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';
import { ImageMagnifier } from '../../../store/component';

interface QingmingSegment {
  id: string;
  image: string;
  alt: string;
  location: string;
}

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, QmahIconComponent, ImageMagnifier],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  loading = false;
  errorMessage = '';
  /** API 沒有回報 OAuth 已啟用前先保持停用，避免顯示無法完成的登入入口。 */
  googleLoginEnabled = false;

  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);
  readonly form;

  /**
   * ui-integration: 登入頁改成清院本《清明上河圖》的分段鑑賞器；每段使用可部署的公開領域影像，
   * 以共用放大鏡承接滑鼠與觸控拖曳，不把主視覺換成 AI 生成素材。
   */
  readonly qingmingSegments: readonly QingmingSegment[] = [
    {
      id: 'segment-01',
      // index.html 會在直接開啟登入頁時預先下載這張；更換路徑時需一併修改。
      image: '/images/login/museum/qingming-court/segment-01.webp',
      alt: '清院本《清明上河圖》畫卷第 01 段的高畫質細節',
      location: '清院本・畫卷第 01 段',
    },
    {
      id: 'segment-06',
      image: '/images/login/museum/qingming-court/segment-06.webp',
      alt: '清院本《清明上河圖》畫卷第 06 段的高畫質細節',
      location: '清院本・畫卷第 06 段',
    },
    {
      id: 'segment-10',
      image: '/images/login/museum/qingming-court/segment-10.webp',
      alt: '清院本《清明上河圖》畫卷第 10 段的高畫質細節',
      location: '清院本・畫卷第 10 段',
    },
    {
      id: 'segment-14',
      image: '/images/login/museum/qingming-court/segment-14.webp',
      alt: '清院本《清明上河圖》畫卷第 14 段的高畫質細節',
      location: '清院本・畫卷第 14 段',
    },
    {
      id: 'segment-18',
      image: '/images/login/museum/qingming-court/segment-18.webp',
      alt: '清院本《清明上河圖》畫卷第 18 段的高畫質細節',
      location: '清院本・畫卷第 18 段',
    },
    {
      id: 'segment-22',
      image: '/images/login/museum/qingming-court/segment-22.webp',
      alt: '清院本《清明上河圖》畫卷第 22 段的高畫質細節',
      location: '清院本・畫卷第 22 段',
    },
  ];

  readonly collectionUrl = 'https://digitalarchive.npm.gov.tw/Collection/Detail/3782?dep=P';
  readonly activeSegmentIndex = signal(0);
  readonly carouselPaused = signal(false);
  readonly carouselSpeedOptions = [0.75, 1, 1.25, 1.5, 2] as const;
  readonly carouselSpeed = signal<number>(1);
  readonly magnifierEnabled = signal(true);
  readonly panKey = signal(0);
  readonly loginPanelOpen = signal(true);
  readonly loginPanelTransitioning = signal(false);
  readonly themeTransitioning = signal(false);
  readonly themeDirection = signal<'to-dark' | 'to-light'>('to-dark');
  readonly theme = this.themeService.theme;
  /** 登入頁 logo 與背板一起隨主題切換，確保在畫卷與表單上都有足夠對比。 */
  readonly logoSrc = computed(() => this.themeService.theme() === 'qmahdark'
    ? '/images/brand/qmah-logo-dark.svg'
    : '/images/brand/qmah-logo.svg');
  readonly activeSegment = computed(
    () => this.qingmingSegments[this.activeSegmentIndex()] ?? this.qingmingSegments[0],
  );
  readonly carouselDurationCss = computed(() => `${Math.round(12000 / this.carouselSpeed())}ms`);

  private readonly carouselSpeedStorageKey = 'qmah.login.carousel-speed';
  private carouselPausedBeforeLensDrag = false;
  /** 暫停期間收到的換段通知；恢復播放時才換段，避免畫卷停在尾端後永遠不前進。 */
  private pendingSegmentAdvance = false;
  /** 最後一次要求切換的段落；解碼完成前連續點擊仍會依序前進。 */
  private requestedSegmentIndex = 0;
  private segmentRequest = 0;
  /** 保留已解碼的畫卷影像，避免被回收後切換時又要重新解碼。 */
  private readonly segmentImages = new Map<string, { image: HTMLImageElement; ready: Promise<void> }>();
  private loginPanelUnlockTimer: ReturnType<typeof setTimeout> | null = null;
  private themeUnlockTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.maxLength(100)]],
      rememberMe: [false],
    });
  }

  ngOnInit(): void {
    this.authService.getCapabilities().subscribe((capabilities) => {
      this.googleLoginEnabled = capabilities.googleLoginEnabled;
    });

    this.restoreCarouselSpeed();
    this.preloadSegment(1);
    // 減少動態偏好下沒有平移動畫，也就不會自動換段；維持暫停狀態讓控制列如實呈現。
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.carouselPaused.set(true);
    }
  }

  ngOnDestroy(): void {
    if (this.loginPanelUnlockTimer) clearTimeout(this.loginPanelUnlockTimer);
    if (this.themeUnlockTimer) clearTimeout(this.themeUnlockTimer);
  }

  selectSegment(index: number): void {
    if (index < 0 || index >= this.qingmingSegments.length) return;
    this.pendingSegmentAdvance = false;
    this.requestedSegmentIndex = index;
    const request = ++this.segmentRequest;

    // 換段會同時換圖並重新開始平移動畫；若新圖還沒解碼，舊圖會先跳回動畫起點。
    // 先等新圖解碼完成再一起切換，畫面就直接從上一段的結尾換到下一段的開頭。
    void this.preloadSegment(index).then(() => {
      if (request !== this.segmentRequest) return;
      this.activeSegmentIndex.set(index);
      this.panKey.update((key) => key + 1);
      this.preloadSegment((index + 1) % this.qingmingSegments.length);
    });
  }

  previousSegment(): void {
    this.selectSegment(
      (this.requestedSegmentIndex - 1 + this.qingmingSegments.length) % this.qingmingSegments.length,
    );
  }

  nextSegment(): void {
    this.selectSegment((this.requestedSegmentIndex + 1) % this.qingmingSegments.length);
  }

  toggleCarousel(): void {
    this.carouselPaused.update((paused) => !paused);
    this.flushPendingSegmentAdvance();
  }

  setCarouselSpeed(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!this.carouselSpeedOptions.some((option) => option === value)) return;

    // ui-integration: 桌面版只在既有鑑賞控制列補速度倍率；記住偏好但不改變登入流程或手機版資訊密度。
    this.carouselSpeed.set(value);
    this.panKey.update((key) => key + 1);
    this.persistCarouselSpeed(value);
  }

  handleLensDragging(isDragging: boolean): void {
    // ui-integration: 拖曳鏡面時暫停自動平移，讓使用者能穩定觀察；放開後只回復原本的播放狀態。
    if (isDragging) {
      this.carouselPausedBeforeLensDrag = this.carouselPaused();
      this.carouselPaused.set(true);
      // 放大鏡會在放開時重新判斷是否停在尾端，舊的待換段通知作廢。
      this.pendingSegmentAdvance = false;
      return;
    }

    if (!this.carouselPausedBeforeLensDrag) this.carouselPaused.set(false);
    this.flushPendingSegmentAdvance();
  }

  /** 換段跟著平移動畫實際播完的時間點（拖曳到尾端時由放大鏡延遲一秒通知），拖曳改變進度後節奏仍一致。 */
  handlePanEnd(): void {
    if (this.qingmingSegments.length < 2) return;
    if (this.carouselPaused()) {
      this.pendingSegmentAdvance = true;
      return;
    }
    this.nextSegment();
  }

  private flushPendingSegmentAdvance(): void {
    if (!this.pendingSegmentAdvance || this.carouselPaused()) return;
    this.pendingSegmentAdvance = false;
    this.nextSegment();
  }

  private preloadSegment(index: number): Promise<void> {
    const segment = this.qingmingSegments[index];
    if (!segment || typeof Image === 'undefined') return Promise.resolve();

    let entry = this.segmentImages.get(segment.image);
    if (!entry) {
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
      });
      image.src = segment.image;
      // 下載完成後再等解碼；背景分頁可能延後 decode()，最多等 300ms，避免輪播因此卡住。
      // 載入或解碼失敗時仍照常換段，交給畫面上的 <img> 自行處理。
      const ready = loaded.then(() => Promise.race([
        image.decode().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 300)),
      ]));
      entry = { image, ready };
      this.segmentImages.set(segment.image, entry);
    }
    return entry.ready;
  }

  toggleMagnifier(): void {
    this.magnifierEnabled.update((enabled) => !enabled);
  }

  toggleLoginPanel(): void {
    if (this.loginPanelTransitioning()) return;

    const nextOpenState = !this.loginPanelOpen();
    const view = this.document.defaultView;
    const prefersReducedMotion = view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
    const documentWithTransition = this.document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };

    // ui-integration: 使用瀏覽器原生 shared-element 轉場，讓登入卡與收合入口保持同一個空間關係；不支援時仍直接切換。
    if (!prefersReducedMotion && documentWithTransition.startViewTransition) {
      this.loginPanelTransitioning.set(true);
      try {
        const transition = documentWithTransition.startViewTransition(() => {
          this.loginPanelOpen.set(nextOpenState);
        });
        void transition.finished.catch(() => undefined);
        this.scheduleLoginPanelTransitionUnlock();
      } catch {
        this.loginPanelOpen.set(nextOpenState);
        this.scheduleLoginPanelTransitionUnlock();
      }
    } else {
      this.loginPanelOpen.set(nextOpenState);
    }

    // ui-integration: 收合／展開後把焦點交給目前唯一的登入入口，避免按鈕消失後使用者迷失在背景畫面。
    view?.setTimeout(() => {
      const focusTarget = () => {
        const target = this.document.querySelector<HTMLElement>(
          nextOpenState ? '#email' : '#login-panel-collapsed',
        );
        target?.focus();
      };
      // Angular 重新建立 @if 內容需要等一個 frame；第二次嘗試讓 shared-element 轉場下的鍵盤焦點也不會落空。
      focusTarget();
      view.requestAnimationFrame(focusTarget);
      if (this.loginPanelTransitioning()) {
        // Chromium 在 shared-element overlay 存在時可能暫時把焦點留在 body；轉場結束後再確認一次。
        view.setTimeout(focusTarget, 600);
      }
    }, 0);
  }

  toggleTheme(event: MouseEvent): void {
    if (this.themeTransitioning()) return;

    const toggle = event.currentTarget as HTMLElement | null;
    if (toggle) {
      const bounds = toggle.getBoundingClientRect();
      this.document.documentElement.style.setProperty(
        '--login-theme-origin-x',
        `${bounds.left + bounds.width / 2}px`,
      );
      this.document.documentElement.style.setProperty(
        '--login-theme-origin-y',
        `${bounds.top + bounds.height / 2}px`,
      );
    }

    const nextTheme: SiteTheme = this.theme() === 'qmahdark' ? 'qmah' : 'qmahdark';
    this.themeDirection.set(nextTheme === 'qmahdark' ? 'to-dark' : 'to-light');
    this.themeTransitioning.set(true);

    const applyTheme = () => {
      this.themeService.setTheme(nextTheme);
    };

    const documentWithTransition = this.document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> };
    };

    try {
      if (documentWithTransition.startViewTransition) {
        const transition = documentWithTransition.startViewTransition(applyTheme);
        // ViewTransition.finished 在部分瀏覽器／快速連點狀態可能不 settle；另設固定上限，避免控制項永久鎖住。
        void transition.finished.catch(() => undefined);
        this.scheduleThemeTransitionUnlock();
        return;
      }
    } catch {
      // 不支援或被瀏覽器中止時，仍回到相同的原生 CSS 光暈流程。
    }

    applyTheme();
    this.scheduleThemeTransitionUnlock();
  }

  googleLogin(): void {
    window.location.href = `${environment.apiBaseUrl}/account/google-login`;
  }

  facebookLogin(): void {
  window.location.href = `${environment.apiBaseUrl}/account/logto-login`;
}
microsoftLogin(): void {
  window.location.href = `${environment.apiBaseUrl}/account/microsoft-login`;
}


  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.loading) return;

    this.loading = true;
    this.errorMessage = '';

    const value = this.form.getRawValue();
    this.authService.login({ ...value, email: value.email.trim() }).subscribe({
      next: () => {
        this.loading = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // ui-integration: 只接受站內絕對路徑，避免登入後導向外部網址；沒有目的地時先回到內容型首頁。
        const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/home';
        void this.router.navigateByUrl(destination);
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 401) {
          this.errorMessage = '電子郵件或密碼錯誤';
          return;
        }

        if (error.status === 400) {
          this.errorMessage = '請確認電子郵件格式與密碼長度';
          return;
        }

        if (error.status === 429) {
          this.errorMessage = '登入嘗試過於頻繁，請稍後再試';
          return;
        }

        if (error.status === 503) {
          this.errorMessage = '服務目前無法連線';
          return;
        }

        this.errorMessage = '登入失敗，請稍後再試';
      },
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleViewerKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previousSegment();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextSegment();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.toggleCarousel();
    }
  }

  private restoreCarouselSpeed(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = Number(window.localStorage.getItem(this.carouselSpeedStorageKey));
      if (this.carouselSpeedOptions.some((option) => option === stored)) {
        this.carouselSpeed.set(stored);
      }
    } catch {
      // localStorage 受瀏覽器隱私設定限制時，維持預設速度即可。
    }
  }

  private persistCarouselSpeed(speed: number): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(this.carouselSpeedStorageKey, String(speed));
    } catch {
      // 無法保存偏好不應影響畫卷鑑賞或登入。
    }
  }

  private scheduleThemeTransitionUnlock(): void {
    if (this.themeUnlockTimer) clearTimeout(this.themeUnlockTimer);

    const finish = () => {
      this.themeUnlockTimer = null;
      this.themeTransitioning.set(false);
    };
    const view = this.document.defaultView;
    if (view) {
      this.themeUnlockTimer = view.setTimeout(finish, 720);
    } else {
      finish();
    }
  }

  private scheduleLoginPanelTransitionUnlock(): void {
    if (this.loginPanelUnlockTimer) clearTimeout(this.loginPanelUnlockTimer);

    const finish = () => {
      this.loginPanelUnlockTimer = null;
      this.loginPanelTransitioning.set(false);
    };
    const view = this.document.defaultView;
    if (view) {
      this.loginPanelUnlockTimer = view.setTimeout(finish, 560);
    } else {
      finish();
    }
  }
}
