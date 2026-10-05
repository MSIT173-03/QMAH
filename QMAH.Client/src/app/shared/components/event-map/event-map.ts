import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// 活動地點的 Google 地圖。使用 Google 內嵌地圖（output=embed），不需要 API 金鑰。
// 有座標時用座標定位（圖釘落在精確位置），沒有座標時用地址／場館名稱搜尋。
@Component({
  selector: 'app-event-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .event-map__frame {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      min-height: 14rem;
      border: 1px solid var(--qmah-border);
      border-radius: var(--qmah-radius-card);
      background: var(--qmah-surface-muted);
    }

    .event-map__link {
      display: inline-block;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  `,
  template: `
    @if (embedUrl(); as url) {
      <iframe
        class="event-map__frame"
        [src]="url"
        title="活動地點地圖"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen
      ></iframe>
      <a class="event-map__link link link-primary" [href]="openUrl()" target="_blank" rel="noopener noreferrer">
        在 Google 地圖開啟
      </a>
    }
  `
})
export class EventMapComponent {
  private sanitizer = inject(DomSanitizer);

  latitude = input<number | null | undefined>(null);
  longitude = input<number | null | undefined>(null);
  location = input<string | null | undefined>(null);

  // 地圖查詢字串：座標優先；純線上活動沒有實體地點，不顯示地圖。
  readonly query = computed<string | null>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (
      typeof lat === 'number' && typeof lng === 'number'
      && Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ) {
      return `${lat},${lng}`;
    }

    const text = this.location()?.trim();
    if (!text || /^(線上|網路|online)/i.test(text)) return null;
    return text;
  });

  // 網址的來源固定是 google.com，查詢字串經過 encodeURIComponent，所以可以安全標記為受信任的 iframe 網址。
  readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const query = this.query();
    if (!query) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`
    );
  });

  readonly openUrl = computed<string | null>(() => {
    const query = this.query();
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : null;
  });
}
