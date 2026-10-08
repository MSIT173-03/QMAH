import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, effect, inject, input, model, output, signal, viewChild } from '@angular/core';
import { LucideCalendarDays, LucideImage, LucideSendHorizontal, LucideSmile, LucideTypeOutline, LucideX } from '@lucide/angular';

import { SocialApiService } from '../../../core/services/social-api';
import { SOCIAL_COLORS } from '../../social-markup';
import { ImageCropModalComponent } from '../image-crop-modal/image-crop-modal';
import { SocialPostContentComponent } from '../social-post-content/social-post-content';

type EditorAction =
  | { kind: 'wrap'; label: string; title: string; open: string; close: string; cls?: string }
  | { kind: 'link' | 'rule' | 'list' | 'break'; label: string; title: string; cls?: string };

/** 表情選擇器的繁體中文介面文字（套件只附簡體版）。 */
const EMOJI_I18N_ZH_TW = {
  categoriesLabel: '類別',
  emojiUnsupportedMessage: '您的瀏覽器不支援彩色表情符號。',
  favoritesLabel: '常用',
  loadingMessage: '載入中…',
  networkErrorMessage: '無法載入表情符號。',
  regionLabel: '表情符號選擇器',
  searchDescription: '有搜尋結果時，按上下鍵選擇，按 Enter 插入。',
  searchLabel: '搜尋',
  searchResultsLabel: '搜尋結果',
  skinToneDescription: '展開時，按上下鍵選擇，按 Enter 確認。',
  skinToneLabel: '選擇膚色（目前為 {skinTone}）',
  skinTonesLabel: '膚色',
  skinTones: ['預設', '明亮', '偏亮', '中等', '偏暗', '深色'],
  categories: {
    custom: '自訂',
    'smileys-emotion': '表情與情緒',
    'people-body': '人物與身體',
    'animals-nature': '動物與自然',
    'food-drink': '飲食',
    'travel-places': '旅行與地點',
    activities: '活動',
    objects: '物品',
    symbols: '符號',
    flags: '旗幟',
  },
};

const COLOR_HEX: Record<string, string> = {
  red: '#b9423c', brown: '#7a5230', green: '#2f7a4f', blue: '#3b5ba8', gold: '#b8862a', gray: '#6f6a60',
};

/**
 * 留言／貼文共用的文字輸入：預設是純文字（換行有效），按左邊的「進階格式」才展開格式工具列；
 * 標記語法與貼文發布器相同（見 social-markup.ts）。
 */
@Component({
  selector: 'app-social-editor',
  imports: [ImageCropModalComponent, LucideCalendarDays, LucideImage, LucideSendHorizontal, LucideSmile, LucideTypeOutline, LucideX, SocialPostContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-editor.scss',
  template: `
    <div class="sme" [class.is-open]="open()">
      <textarea #field class="sme__field" [attr.aria-label]="label()" [placeholder]="placeholder()" [rows]="rows()" [value]="value()" (input)="value.set(field.value)" (keydown.control.enter)="submitted.emit()" (keydown.meta.enter)="submitted.emit()"></textarea>
      @if (open()) {
        <div class="sme__toolbar" role="toolbar" aria-label="格式工具" (mousedown)="$event.preventDefault()">
          @for (group of groups; track $index) {
            <div class="sme__group">
              @for (a of group; track a.title) {
                <button type="button" [class]="'sme__fmt ' + (a.cls ?? '')" [title]="a.title" [attr.aria-label]="a.title" (click)="run(a)">{{ a.label }}</button>
              }
            </div>
          }
          <div class="sme__group">
            @for (c of colors; track c.color) {
              <button type="button" class="sme__swatch" [style.background]="hex(c.color)" [title]="c.label" [attr.aria-label]="c.label" (click)="wrap('[color=' + c.color + ']', '[/color]')"></button>
            }
          </div>
        </div>
      }
      @if (images().length > 0) {
        <div class="sme__images">
          @for (img of images(); track img.id) {
            <div class="sme__image">
              <img [src]="img.url" alt="" />
              <button type="button" class="sme__image-remove" aria-label="移除這張圖片" (click)="removeImage(img)"><svg lucideX aria-hidden="true" focusable="false"></svg></button>
            </div>
          }
        </div>
      }
      @if (error()) { <p class="sme__error" role="alert">{{ error() }}</p> }
      @if (open() && value().trim()) {
        <div class="sme__preview"><span class="sme__preview-label">預覽</span><app-social-post-content [content]="value()" /></div>
      }
      <div class="sme__bar">
        <div class="sme__tools">
          @if (allowImage()) {
            <button type="button" class="sme__tool" title="附上圖片" aria-label="附上圖片" [disabled]="uploading()" (click)="picker.click()"><svg lucideImage aria-hidden="true" focusable="false"></svg></button>
            <input #picker type="file" hidden multiple accept="image/jpeg,image/png,image/gif,image/webp" (change)="onPick($event)" />
          }
          <div class="sme__emoji-wrap">
            <button type="button" class="sme__tool" title="表情符號" aria-label="表情符號" [attr.aria-expanded]="emojiOpen()" (click)="toggleEmoji()"><svg lucideSmile aria-hidden="true" focusable="false"></svg></button>
            <div #emojiHost class="sme__emoji" [hidden]="!emojiOpen()" (mousedown)="$event.stopPropagation()"></div>
          </div>
          <button type="button" class="sme__tool" title="附上日期小標" aria-label="附上日期小標" (click)="insertDate()"><svg lucideCalendarDays aria-hidden="true" focusable="false"></svg></button>
          <button type="button" class="sme__tool" [class.is-on]="open()" [attr.aria-pressed]="open()" [title]="open() ? '收起進階格式' : '進階格式（粗體、連結、劇透…）'" [attr.aria-label]="open() ? '收起進階格式' : '進階格式'" (click)="open.set(!open())"><svg lucideTypeOutline aria-hidden="true" focusable="false"></svg></button>
          @if (uploading()) { <span class="sme__status">圖片上傳中…</span> }
        </div>
        @if (showSend()) {
          <button type="button" class="sme__send" aria-label="送出" title="送出（Ctrl＋Enter）" [disabled]="!canSend()" (click)="submitted.emit()"><svg lucideSendHorizontal aria-hidden="true" focusable="false"></svg></button>
        }
      </div>
    </div>
    <app-image-crop-modal (cropped)="onCropped($event)" (cancelled)="onCropCancelled()" />
  `,
})
export class SocialEditorComponent implements OnInit {
  private readonly api = inject(SocialApiService);
  readonly value = model('');
  readonly placeholder = input('留下你的想法…');
  readonly label = input('內容');
  readonly rows = input(3);
  readonly showSend = input(true);
  readonly startOpen = input(false);
  /** 進階模式才會出現圖片按鈕；圖片以 [img=識別碼] 嵌入文字 */
  readonly allowImage = input(true);
  readonly submitted = output<void>();

  protected readonly open = signal(false);
  protected readonly emojiOpen = signal(false);
  private readonly emojiHost = viewChild<ElementRef<HTMLElement>>('emojiHost');
  private emojiLoaded = false;
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** 已上傳、嵌在文字裡的圖片（縮圖列），最多 4 張 */
  protected readonly images = signal<{ id: string; url: string }[]>([]);
  private readonly cropModal = viewChild.required(ImageCropModalComponent);
  private cropQueue: File[] = [];
  private static readonly MAX_IMAGES = 4;
  private readonly resetImages = effect(() => { if (this.value() === '') this.images.set([]); });
  protected readonly canSend = computed(() => this.value().trim().length > 0);
  protected readonly colors = SOCIAL_COLORS;
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');

  protected readonly groups: EditorAction[][] = [
    [
      { kind: 'wrap', label: 'B', title: '粗體', open: '[b]', close: '[/b]', cls: 'sme__fmt--b' },
      { kind: 'wrap', label: 'I', title: '斜體', open: '[i]', close: '[/i]', cls: 'sme__fmt--i' },
      { kind: 'wrap', label: 'U', title: '底線', open: '[u]', close: '[/u]', cls: 'sme__fmt--u' },
      { kind: 'wrap', label: 'S', title: '刪除線', open: '[s]', close: '[/s]', cls: 'sme__fmt--s' },
    ],
    [
      { kind: 'wrap', label: '小標', title: '小標題', open: '[h]', close: '[/h]' },
      { kind: 'wrap', label: '引用', title: '引用', open: '[quote]', close: '[/quote]' },
      { kind: 'list', label: '清單', title: '項目清單' },
      { kind: 'wrap', label: '置中', title: '置中', open: '[center]', close: '[/center]' },
      { kind: 'rule', label: '分隔線', title: '分隔線' },
    ],
    [
      { kind: 'link', label: '連結', title: '連結' },
      { kind: 'wrap', label: '劇透', title: '劇透：點擊才顯示', open: '[spoiler]', close: '[/spoiler]' },
    ],
  ];

  ngOnInit(): void {
    if (this.startOpen()) this.open.set(true);
  }

  /** 選檔：與發文器相同，先進裁切彈窗確認，再上傳。 */
  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    const room = SocialEditorComponent.MAX_IMAGES - this.images().length;
    if (room <= 0) { this.error.set('留言最多附 ' + SocialEditorComponent.MAX_IMAGES + ' 張圖片。'); return; }
    this.error.set(null);
    this.cropQueue.push(...files.slice(0, room));
    this.nextInQueue();
  }

  private nextInQueue(): void {
    const next = this.cropQueue.shift();
    if (next) this.cropModal().open(next);
  }

  protected onCropCancelled(): void {
    this.nextInQueue();
  }

  protected onCropped(file: File): void {
    this.uploading.set(true);
    this.error.set(null);
    this.api.uploadMedia(file).subscribe({
      next: (media) => {
        this.uploading.set(this.cropQueue.length > 0);
        this.open.set(true);
        this.images.update((list) => [...list, { id: media.id, url: media.url }]);
        const el = this.field().nativeElement;
        const at = el.selectionEnd ?? el.value.length;
        const head = el.value.slice(0, at);
        const insert = (head.length === 0 || head.endsWith('\n') ? '' : '\n') + '[img=' + media.id + ']\n';
        this.apply(head + insert + el.value.slice(at), at + insert.length, at + insert.length);
        this.nextInQueue();
      },
      error: (err) => {
        this.uploading.set(this.cropQueue.length > 0);
        this.error.set(err?.status === 401 ? '上傳圖片失敗：請先登入。' : err?.status === 413 ? '圖片不可超過 8 MB。' : '上傳圖片失敗，請確認格式是 JPEG／PNG／GIF／WebP。');
        this.nextInQueue();
      },
    });
  }

  protected removeImage(img: { id: string; url: string }): void {
    this.images.update((list) => list.filter((item) => item.id !== img.id));
    const marker = new RegExp('\\n?\\[img=' + img.id + '\\]\\n?', 'i');
    this.value.set(this.value().replace(marker, '\n').replace(/^\n/, ''));
    this.api.deleteMedia(img.id).subscribe({ error: () => undefined });
  }

  /** 開關完整表情選擇器；第一次開啟才載入（元件約 50 KB、資料放在 /emoji/，不連外部網站）。 */
  protected async toggleEmoji(): Promise<void> {
    if (this.emojiOpen()) { this.emojiOpen.set(false); return; }
    this.emojiOpen.set(true);
    if (this.emojiLoaded) return;
    this.emojiLoaded = true;
    const host = this.emojiHost()?.nativeElement;
    if (!host) return;
    const { Picker } = await import('emoji-picker-element');
    const picker = new Picker({ dataSource: '/emoji/zh-emojibase.json', locale: 'zh', i18n: EMOJI_I18N_ZH_TW });
    Object.assign(picker.style, { width: 'min(340px, calc(100vw - 32px))', height: '360px' });
    picker.style.setProperty('--num-columns', '8');
    picker.style.setProperty('--emoji-size', '1.35rem');
    picker.style.setProperty('--emoji-font-family', '"Noto Color Emoji", sans-serif');
    picker.style.setProperty('--border-radius', '12px');
    picker.classList.add(document.documentElement.getAttribute('data-theme') === 'qmahdark' ? 'dark' : 'light');
    picker.addEventListener('emoji-click', (event) => {
      const unicode = (event as unknown as CustomEvent<{ unicode?: string }>).detail?.unicode;
      if (unicode) this.insertText(unicode);
    });
    host.appendChild(picker);
  }

  /** 在游標處插入文字（表情）。 */
  protected insertText(text: string): void {
    const el = this.field().nativeElement;
    const { selectionStart: start, selectionEnd: end } = el;
    const caret = start + text.length;
    this.apply(el.value.slice(0, start) + text + el.value.slice(end), caret, caret);
    this.emojiOpen.set(false);
  }

  /** 附上日期：插入一個獨立一行的日期小標，例如「[h]2026-10-08[/h]」。 */
  protected insertDate(): void {
    const el = this.field().nativeElement;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const at = el.selectionEnd ?? el.value.length;
    const head = el.value.slice(0, at);
    const insert = (head.length === 0 || head.endsWith('\n') ? '' : '\n') + '[h]' + label + '[/h]\n';
    this.apply(head + insert + el.value.slice(at), at + insert.length, at + insert.length);
  }

  protected hex(color: string): string {
    return COLOR_HEX[color] ?? '#888';
  }

  protected run(action: EditorAction): void {
    switch (action.kind) {
      case 'wrap': this.wrap(action.open, action.close); break;
      case 'link': this.link(); break;
      case 'rule': this.rule(); break;
      case 'list': this.list(); break;
      case 'break': break;
    }
  }

  private apply(value: string, selStart: number, selEnd: number): void {
    const el = this.field().nativeElement;
    this.value.set(value);
    el.value = value;
    el.focus();
    el.setSelectionRange(selStart, selEnd);
  }

  /** 以成對標記包住選取文字；已被同一組標記包住時再按一次會取消。 */
  protected wrap(open: string, close: string): void {
    const el = this.field().nativeElement;
    const value = el.value;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end);
    const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
    if (selected.length >= open.length + close.length && same(selected.slice(0, open.length), open) && same(selected.slice(-close.length), close)) {
      const inner = selected.slice(open.length, selected.length - close.length);
      this.apply(value.slice(0, start) + inner + value.slice(end), start, start + inner.length);
      return;
    }
    const before = value.slice(Math.max(0, start - open.length), start);
    const after = value.slice(end, end + close.length);
    if (same(before, open) && same(after, close)) {
      this.apply(value.slice(0, start - open.length) + selected + value.slice(end + close.length), start - open.length, start - open.length + selected.length);
      return;
    }
    const caret = start + open.length;
    this.apply(value.slice(0, start) + open + selected + close + value.slice(end), caret, caret + selected.length);
  }

  private link(): void {
    const el = this.field().nativeElement;
    const value = el.value;
    const { selectionStart: start, selectionEnd: end } = el;
    const label = value.slice(start, end) || '連結文字';
    const open = '[url=https://';
    const urlStart = start + '[url='.length;
    this.apply(value.slice(0, start) + open + ']' + label + '[/url]' + value.slice(end), urlStart, urlStart + 'https://'.length);
  }

  private rule(): void {
    const el = this.field().nativeElement;
    const value = el.value;
    const at = el.selectionEnd;
    const head = value.slice(0, at);
    const insert = (head.length === 0 || head.endsWith('\n') ? '' : '\n') + '[hr]\n';
    this.apply(head + insert + value.slice(at), at + insert.length, at + insert.length);
  }

  private list(): void {
    const el = this.field().nativeElement;
    const value = el.value;
    const { selectionStart: start, selectionEnd: end } = el;
    const lines = value.slice(start, end).split('\n').map(line => line.trim()).filter(Boolean);
    const items = lines.length ? lines : [''];
    const text = '[list]\n' + items.map(line => '[*]' + line).join('\n') + '\n[/list]';
    const caret = lines.length ? start + text.length : start + '[list]\n[*]'.length;
    this.apply(value.slice(0, start) + text + value.slice(end), caret, caret);
  }
}
