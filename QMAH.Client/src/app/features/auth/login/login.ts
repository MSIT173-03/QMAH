import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  Router,
  RouterLink
} from '@angular/router';

import {
  AuthService
} from '../../../core/auth/auth.service';

import { environment } from '../../../../environments/environment';


interface LoginSlide {
  image: string;
  tag: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
}


@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit, OnDestroy {

  /* =========================
     Login
  ========================= */

  loading = false;
  errorMessage = '';
  /** API 沒有回報 OAuth 已啟用前先保持停用，避免按鈕導向明知不可用的 503。 */
  googleLoginEnabled = false;

  form;


  /* =========================
     Carousel
  ========================= */

  currentSlideIndex = 0;

  isSlideChanging = false;

  private carouselTimer?: ReturnType<typeof setInterval>;

  private slideChangeTimer?: ReturnType<typeof setTimeout>;


  slides: LoginSlide[] = [

    {
      image: '/images/login/qingming.png',
      tag: 'TIMELESS MASTERPIECE',
      titleLine1: '一卷清明',
      titleLine2: '千年人間',
      description: '走進繁華街巷，在畫卷之中遇見古人的生活。'
    },

    {
      image: '/images/login/meat-stone.png',
      tag: 'STONE OR DELICACY',
      titleLine1: '東坡有味',
      titleLine2: '奇石成珍',
      description: '乍看一席東坡肉，細看方知石中珍。'
    }

  ];


  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {

    this.form = this.fb.nonNullable.group({

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required
        ]
      ],

      rememberMe: [
        false
      ]

    });

  }


  /* =========================
     Lifecycle
  ========================= */

  ngOnInit(): void {

    this.startCarousel();
    this.authService.getCapabilities().subscribe((capabilities) => {
      this.googleLoginEnabled = capabilities.googleLoginEnabled;
    });

  }


  ngOnDestroy(): void {

    this.stopCarousel();

    if (this.slideChangeTimer) {
      clearTimeout(this.slideChangeTimer);
    }

  }


  /* =========================
     Carousel
  ========================= */

  get currentSlide(): LoginSlide {

    return this.slides[this.currentSlideIndex];

  }


  nextSlide(): void {

    if (this.isSlideChanging) {
      return;
    }

    const nextIndex =
      (this.currentSlideIndex + 1) %
      this.slides.length;

    this.changeSlide(nextIndex);

    this.restartCarousel();

  }


  previousSlide(): void {

    if (this.isSlideChanging) {
      return;
    }

    const previousIndex =
      (
        this.currentSlideIndex -
        1 +
        this.slides.length
      ) %
      this.slides.length;

    this.changeSlide(previousIndex);

    this.restartCarousel();

  }


  goToSlide(index: number): void {

    if (
      index < 0 ||
      index >= this.slides.length ||
      index === this.currentSlideIndex ||
      this.isSlideChanging
    ) {
      return;
    }

    this.changeSlide(index);

    this.restartCarousel();

  }


  /**
   * 淡出 → 換圖 → 淡入
   */
  private changeSlide(index: number): void {

    if (
      this.isSlideChanging ||
      this.slides.length <= 1
    ) {
      return;
    }


    // 先淡出
    this.isSlideChanging = true;

    this.cdr.detectChanges();


    this.slideChangeTimer = setTimeout(() => {

      // 淡出完成後換圖片與文字
      this.currentSlideIndex = index;

      this.cdr.detectChanges();


      // 下一個 frame 再取消 class
      // 讓新圖片有淡入效果
      requestAnimationFrame(() => {

        requestAnimationFrame(() => {

          this.isSlideChanging = false;

          this.cdr.detectChanges();

        });

      });

    }, 450);

  }


  private startCarousel(): void {

    this.stopCarousel();


    if (this.slides.length <= 1) {
      return;
    }


    this.carouselTimer = setInterval(() => {

      if (this.isSlideChanging) {
        return;
      }


      const nextIndex =
        (this.currentSlideIndex + 1) %
        this.slides.length;


      this.changeSlide(nextIndex);

    }, 6000);

  }


  private stopCarousel(): void {

    if (!this.carouselTimer) {
      return;
    }


    clearInterval(
      this.carouselTimer
    );


    this.carouselTimer = undefined;

  }


  private restartCarousel(): void {

    this.stopCarousel();

    this.startCarousel();

  }


  /* =========================
     Google Login
  ========================= */

  googleLogin(): void {

    window.location.href =
      `${environment.apiBaseUrl}/account/google-login`;

  }


  /* =========================
     Login
  ========================= */

  login(): void {

    if (this.form.invalid) {

      this.form.markAllAsTouched();

      return;

    }


    if (this.loading) {
      return;
    }


    this.loading = true;
    this.errorMessage = '';


    this.authService
      .login(
        this.form.getRawValue()
      )
      .subscribe({

        next: () => {

          this.loading = false;

          this.router.navigate([
            '/member'
          ]);

        },

        error: (error) => {

          this.loading = false;


          if (error.status === 401) {

            this.errorMessage =
              'Email 或密碼錯誤';

            return;

          }


          if (error.status === 503) {

            this.errorMessage =
              '資料庫目前無法連線';

            return;

          }


          this.errorMessage =
            '登入失敗，請稍後再試';

        }

      });

  }

}
