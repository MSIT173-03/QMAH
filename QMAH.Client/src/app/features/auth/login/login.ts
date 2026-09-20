import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import {
  AuthService
} from '../../../core/auth/auth.service';

import { environment } from '../../../../environments/environment';
import { QmahIconComponent } from '../../../shared/components/qmah-icon/qmah-icon';


@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    QmahIconComponent
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit {

  /* =========================
     Login
  ========================= */

  loading = false;
  errorMessage = '';
  /** API 沒有回報 OAuth 已啟用前先保持停用，避免按鈕導向明知不可用的 503。 */
  googleLoginEnabled = false;

  form;


  /* =========================
     清明長卷主視覺
  ========================= */

  /**
   * 這兩段是由故宮公開 IIIF 端點預先下載的高解析素材；登入頁不在執行時依賴
   * 故宮服務，因此展示不會因第三方短暫失效而破圖。分段也避免把超寬長卷縮成
   * 一張低清背景，4K 螢幕仍能保留畫面細節。
   */
  readonly scrollSegments = [
    {
      key: 'a-1',
      source: '/images/login/real/qingming-iiif/segment-SDAAB.jpg',
      compact: '/images/login/real/qingming-iiif/segment-SDAAB-compact.jpg',
    },
    {
      key: 'b-1',
      source: '/images/login/real/qingming-iiif/segment-SDAAA.jpg',
      compact: '/images/login/real/qingming-iiif/segment-SDAAA-compact.jpg',
    },
    // 複製一個週期讓 CSS 位移回到起點時不會出現跳接；瀏覽器會沿用相同 URL 快取。
    {
      key: 'a-2',
      source: '/images/login/real/qingming-iiif/segment-SDAAB.jpg',
      compact: '/images/login/real/qingming-iiif/segment-SDAAB-compact.jpg',
    },
    {
      key: 'b-2',
      source: '/images/login/real/qingming-iiif/segment-SDAAA.jpg',
      compact: '/images/login/real/qingming-iiif/segment-SDAAA-compact.jpg',
    },
  ] as const;

  /** 外部 IIIF 暫時不可用時仍使用本地合法文物圖，維持完整品牌視覺而非切換成陽春介面。 */
  readonly scrollFallback = '/images/login/real/cloisonne-tripod-incense-burner.jpg';
  readonly scrollSourceUrl = 'https://digitalarchive.npm.gov.tw/Collection/Detail/3782?dep=P';
  readonly heroKicker = '清院本《清明上河圖》・高畫質長卷';
  readonly heroTitle = '沿著長卷，看見一座城的日常';
  readonly heroDescription = '登入後可以收藏文物、解鎖圖鑑，也能和其他玩家一起遊戲。';
  scrollPaused = false;
  scrollImageFailed = false;


  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
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
    this.authService.getCapabilities().subscribe((capabilities) => {
      this.googleLoginEnabled = capabilities.googleLoginEnabled;
    });

  }

  /** 長卷動畫可手動暫停，並由 CSS 的 reduced-motion 規則支援偏好減少動態。 */
  toggleScroll(): void {
    this.scrollPaused = !this.scrollPaused;
  }

  /** 圖片層失敗時只切換到同頁的合法靜態主視覺，不影響登入表單與整個頁面。 */
  handleScrollImageError(): void {
    this.scrollImageFailed = true;
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

          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          // ui-integration: 只接受站內絕對路徑，避免登入後導向外部網址；沒有目的地時維持會員中心作為預設入口。
          const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/member';
          void this.router.navigateByUrl(destination);

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
