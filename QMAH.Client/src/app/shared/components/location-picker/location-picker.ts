import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';

// 活動地點選擇器：用 Leaflet + OpenStreetMap 圖磚顯示地圖，點一下或拖曳圖釘就能選位置，
// 並用 Nominatim 把座標換成地址文字（反向地理編碼）、也能用文字搜尋場館。
// 這些服務都不需要 API 金鑰；Nominatim 有「每秒最多 1 次請求」的使用規範，
// 所以只在使用者點擊／拖曳／按搜尋時才查詢，不做輸入即時搜尋。
// Leaflet 從 CDN 於第一次使用時才載入，不增加 npm 依賴，也不影響其他頁面的載入速度。

const LEAFLET_VERSION = '1.9.4';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface NominatimAddress {
  state?: string;
  city?: string;
  county?: string;
  city_district?: string;
  town?: string;
  township?: string;
  suburb?: string;
  road?: string;
  house_number?: string;
  country_code?: string;
}

// 台灣地址組成「XX市XX區XX路XX巷XX號」；缺路名或不是台灣就退回 Nominatim 的原始 display_name。
function formatAddress(item: { display_name?: string; address?: NominatimAddress }): string {
  const fallback = typeof item.display_name === 'string' ? item.display_name.trim() : '';
  const a = item.address;
  if (!a || a.country_code !== 'tw' || !a.road) return fallback;

  const city = a.county ?? a.city ?? a.state ?? '';
  const district = a.city_district ?? a.town ?? a.township ?? (a.suburb && !/[里村]$/.test(a.suburb) ? a.suburb : '');
  const number = a.house_number ? (a.house_number.includes('號') ? a.house_number : `${a.house_number}號`) : '';
  return `${city}${district}${a.road}${number}`.trim() || fallback;
}
const DEFAULT_CENTER: [number, number] = [25.033, 121.5654];
const MAX_LOCATION_LENGTH = 200; // 與後端 Event.Location 長度上限一致

const PIN_HTML = `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true" focusable="false" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M14 0C6.3 0 0 6.2 0 13.8 0 24 14 36 14 36s14-12 14-22.2C28 6.2 21.7 0 14 0z" fill="#d9480f" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`;

export interface LocationPick {
  latitude: number;
  longitude: number;
  // 反向地理編碼成功才有值；null 代表「只更新座標，保留使用者原本填的地址文字」。
  location: string | null;
}

interface SearchResult {
  name: string;
  latitude: number;
  longitude: number;
}

// 為了不增加 npm 依賴，Leaflet 以全域物件方式使用，這裡刻意不宣告完整型別。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletApi = any;

let leafletPromise: Promise<LeafletApi> | null = null;

function loadLeaflet(): Promise<LeafletApi> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    const existing = (window as unknown as { L?: LeafletApi }).L;
    if (existing) {
      resolve(existing);
      return;
    }

    const base = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}/leaflet.css`;
    css.crossOrigin = '';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = `${base}/leaflet.js`;
    script.async = true;
    script.crossOrigin = '';
    script.onload = () => resolve((window as unknown as { L: LeafletApi }).L);
    script.onerror = () => {
      leafletPromise = null; // 允許使用者稍後重試
      reject(new Error('Leaflet 載入失敗'));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function isValidPoint(latitude: unknown, longitude: unknown): latitude is number {
  return (
    typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .picker {
      display: grid;
      gap: 0.5rem;
    }

    .picker__search {
      display: flex;
      gap: 0.5rem;
    }

    .picker__search input {
      flex: 1 1 auto;
      min-width: 0;
    }

    .picker__results {
      margin: 0;
      padding: 0.25rem;
      list-style: none;
      border: 1px solid var(--qmah-border);
      border-radius: var(--qmah-radius-card);
      background: var(--qmah-surface-elevated);
      max-height: 11rem;
      overflow-y: auto;
    }

    .picker__result {
      display: block;
      width: 100%;
      padding: 0.4rem 0.6rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: inherit;
      font-size: 0.875rem;
      line-height: 1.4;
      text-align: left;
      cursor: pointer;
    }

    .picker__result:hover,
    .picker__result:focus-visible {
      background: var(--qmah-surface-muted);
    }

    .picker__map {
      position: relative;
      isolation: isolate; /* 把 Leaflet 的高 z-index 圖層限制在地圖內，不會蓋到對話框的其他元素 */
      width: 100%;
      height: 18rem;
      border: 1px solid var(--qmah-border);
      border-radius: var(--qmah-radius-card);
      background: var(--qmah-surface-muted);
    }

    .picker__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--qmah-muted);
    }
  `,
  template: `
    <div class="picker">
      <div class="picker__search">
        <input
          type="search"
          class="input input-bordered"
          placeholder="搜尋場館或地址，例如：台北 101"
          aria-label="搜尋地點"
          [(ngModel)]="searchText"
          [ngModelOptions]="{ standalone: true }"
          (keydown.enter)="onSearchEnter($event)"
        />
        <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="search()">搜尋</button>
      </div>

      @if (results().length > 0) {
        <ul class="picker__results" aria-label="搜尋結果">
          @for (result of results(); track $index) {
            <li><button type="button" class="picker__result" (click)="choose(result)">{{ result.name }}</button></li>
          }
        </ul>
      }

      <div
        #mapHost
        class="picker__map"
        role="application"
        aria-label="地點選擇地圖：點擊地圖放置圖釘，或拖曳圖釘微調位置"
      ></div>

      <div class="picker__foot">
        <span aria-live="polite">{{ message() ?? '點擊地圖放置圖釘，也可以拖曳圖釘微調位置。' }}</span>
        @if (hasPoint()) {
          <button type="button" class="btn btn-ghost btn-xs" (click)="clear()">清除位置</button>
        }
      </div>
    </div>
  `
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  // 目前已選的座標（由父層表單提供）；父層清空時，圖釘也會跟著移除。
  latitude = input<number | null | undefined>(null);
  longitude = input<number | null | undefined>(null);

  picked = output<LocationPick>();
  cleared = output<void>();

  @ViewChild('mapHost', { static: true }) private mapHost!: ElementRef<HTMLDivElement>;

  searchText = '';
  readonly results = signal<SearchResult[]>([]);
  readonly message = signal<string | null>(null);
  readonly busy = signal(false);
  readonly hasPoint = computed(() => isValidPoint(this.latitude(), this.longitude()));

  private map: LeafletApi | null = null;
  private marker: LeafletApi | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private initializing = false;
  private destroyed = false;
  private requestId = 0;

  constructor() {
    // 父層改了座標（例如送出後重設表單）時，讓圖釘同步。
    effect(() => {
      const latitude = this.latitude();
      const longitude = this.longitude();
      this.syncMarker(latitude, longitude);
    });
  }

  ngAfterViewInit(): void {
    // 活動表單放在 <dialog> 裡，關閉時地圖容器的大小是 0，Leaflet 在 0 大小的容器裡無法正確初始化；
    // 所以等容器真的有尺寸（對話框打開）才建立地圖，之後尺寸變動再 invalidateSize。
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => void this.onResize());
    this.resizeObserver.observe(this.mapHost.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }

  onSearchEnter(event: Event): void {
    event.preventDefault(); // 避免 Enter 觸發外層對話框的送出行為
    void this.search();
  }

  // Nominatim 文字搜尋：只在按下搜尋時查詢一次。
  async search(): Promise<void> {
    const query = this.searchText.trim();
    if (!query) return;

    const id = ++this.requestId;
    this.busy.set(true);
    this.results.set([]);
    this.message.set('搜尋中…');
    try {
      const response = await fetch(
        `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=1&countrycodes=tw&limit=5&accept-language=zh-TW&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as Array<{ lat: string; lon: string; display_name: string; address?: NominatimAddress }>;
      if (id !== this.requestId) return;

      const found = data
        .map((item) => ({
          name: formatAddress(item),
          latitude: Number(item.lat),
          longitude: Number(item.lon)
        }))
        .filter((item) => item.name && isValidPoint(item.latitude, item.longitude));

      this.results.set(found);
      this.message.set(found.length === 0 ? '找不到符合的地點，換個關鍵字試試，或直接在地圖上點選。' : null);
    } catch {
      if (id !== this.requestId) return;
      this.message.set('搜尋失敗（網路或服務忙碌），請稍後再試，或直接在地圖上點選。');
    } finally {
      if (id === this.requestId) this.busy.set(false);
    }
  }

  // 從搜尋結果選一筆：地圖移過去、放圖釘，地址文字直接用搜尋結果的名稱（不必再反查一次）。
  choose(result: SearchResult): void {
    this.results.set([]);
    this.message.set(null);
    this.map?.setView([result.latitude, result.longitude], 17);
    const latitude = roundCoordinate(result.latitude);
    const longitude = roundCoordinate(result.longitude);
    this.placeMarker(latitude, longitude);
    this.picked.emit({ latitude, longitude, location: result.name.slice(0, MAX_LOCATION_LENGTH) });
  }

  clear(): void {
    this.marker?.remove();
    this.marker = null;
    this.results.set([]);
    this.message.set(null);
    this.cleared.emit();
  }

  // 點擊地圖或拖曳圖釘：先立刻回報座標，再反查地址；反查失敗時座標仍然保留。
  async selectPoint(rawLatitude: number, rawLongitude: number): Promise<void> {
    const latitude = roundCoordinate(rawLatitude);
    const longitude = roundCoordinate(rawLongitude);
    this.placeMarker(latitude, longitude);
    this.results.set([]);
    this.picked.emit({ latitude, longitude, location: null });

    const id = ++this.requestId;
    this.busy.set(true);
    this.message.set('正在取得地址…');
    try {
      const response = await fetch(
        `${NOMINATIM_URL}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=zh-TW&lat=${latitude}&lon=${longitude}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { display_name?: string; address?: NominatimAddress };
      if (id !== this.requestId) return;

      const name = formatAddress(data);
      if (name) {
        this.picked.emit({ latitude, longitude, location: name.slice(0, MAX_LOCATION_LENGTH) });
        this.message.set(null);
      } else {
        this.message.set('這個位置查不到地址，已記下座標；可以自己補上地址文字。');
      }
    } catch {
      if (id !== this.requestId) return;
      this.message.set('取得地址失敗（網路或服務忙碌），已記下座標；可以自己輸入地址文字。');
    } finally {
      if (id === this.requestId) this.busy.set(false);
    }
  }

  private async onResize(): Promise<void> {
    const host = this.mapHost.nativeElement;
    if (host.clientWidth === 0 || host.clientHeight === 0) return;

    if (this.map) {
      this.map.invalidateSize();
      return;
    }
    if (this.initializing) return;

    this.initializing = true;
    try {
      const leaflet = await loadLeaflet();
      if (!this.destroyed && !this.map) this.createMap(leaflet);
    } catch {
      this.message.set('地圖載入失敗，請檢查網路後重新開啟；也可以直接手動輸入地址。');
    } finally {
      this.initializing = false;
    }
  }

  private createMap(leaflet: LeafletApi): void {
    const latitude = this.latitude();
    const longitude = this.longitude();
    const hasPoint = isValidPoint(latitude, longitude);

    this.map = leaflet.map(this.mapHost.nativeElement, {
      center: hasPoint ? [latitude, longitude] : DEFAULT_CENTER,
      zoom: hasPoint ? 16 : 13
    });
    leaflet
      .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者'
      })
      .addTo(this.map);

    this.map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
      void this.selectPoint(event.latlng.lat, event.latlng.lng);
    });

    if (hasPoint) this.placeMarker(latitude as number, longitude as number);
  }

  private placeMarker(latitude: number, longitude: number): void {
    const leaflet = (window as unknown as { L?: LeafletApi }).L;
    if (!this.map || !leaflet) return;

    if (this.marker) {
      this.marker.setLatLng([latitude, longitude]);
      return;
    }

    // 用 divIcon + 內嵌 SVG，不依賴 Leaflet 預設圖釘的圖片檔（打包後路徑容易壞掉）。
    const icon = leaflet.divIcon({
      className: '',
      html: PIN_HTML,
      iconSize: [28, 36],
      iconAnchor: [14, 36]
    });
    this.marker = leaflet
      .marker([latitude, longitude], { icon, draggable: true, title: '活動地點（可拖曳）' })
      .addTo(this.map);
    this.marker.on('dragend', () => {
      const position = this.marker.getLatLng();
      void this.selectPoint(position.lat, position.lng);
    });
  }

  private syncMarker(latitude: number | null | undefined, longitude: number | null | undefined): void {
    if (!this.map) return;

    if (!isValidPoint(latitude, longitude)) {
      this.marker?.remove();
      this.marker = null;
      return;
    }

    const current = this.marker?.getLatLng();
    if (current && roundCoordinate(current.lat) === latitude && roundCoordinate(current.lng) === longitude) return;
    this.placeMarker(latitude, longitude as number);
  }
}
