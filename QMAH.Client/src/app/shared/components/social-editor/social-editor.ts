import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { LucideImagePlus, LucideSendHorizontal, LucideTypeOutline } from '@lucide/angular';

import { SocialApiService } from '../../../core/services/social-api';
import { SOCIAL_COLORS } from '../../social-markup';
import { SocialPostContentComponent } from '../social-post-content/social-post-content';

type EditorAction =
  | { kind: 'wrap'; label: string; title: string; open: string; close: string; cls?: string }
  | { kind: 'link' | 'rule' | 'list' | 'break'; label: string; title: string; cls?: string };

const COLOR_HEX: Record<string, string> = {
  red: '#b9423c', brown: '#7a5230', green: '#2f7a4f', blue: '#3b5ba8', gold: '#b8862a', gray: '#6f6a60',
};

/**
 * 留言／貼文共用的文字輸入：預設是純文字（換行有效），按左邊的「進階格式」才展開格式工具列；
 * 標記語法與貼文發布器相同（見 social-markup.ts）。
 */
@Component({
  selector: 'app-social-editor',
  imports: [LucideImagePlus, LucideSendHorizontal, LucideTypeOutline, SocialPostContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-editor.scss',
  template: `
    <div class="sme" [class.is-open]="open()">
      @if (open()) {
        <div class="sme__toolbar" role="toolbar" aria-label="格式工具" (mousedown)="$event.preventDefault()">
          @for (group of groups; track $index) {
            <div class="sme__group">
              @for (a of group; track a.title) {
                <button type="button" class="sme__fmt" [class]="'sme__fmt ' + (a.cls ?? '')" [title]="a.title" [attr.aria-label]="a.title" (click)="run(a)">{{ a.label }}</button>
              }
            </div>
          }
          @if (allowImage()) {
            <div class="sme__group">
              <button type="button" class="sme__fmt sme__fmt--icon" title="插入圖片" aria-label="插入圖片" [disabled]="uploading()" (click)="picker.click()"><svg lucideImagePlus aria-hidden="true" focusable="false"></svg>{{ uploading() ? '上傳中…' : '圖片' }}</button>
              <input #picker type="file" hidden accept="image/jpeg,image/png,image/gif,image/webp" (change)="onPick($event)" />
            </div>
          }
          <div class="sme__group">
            @for (c of colors; track c.color) {
              <button type="button" class="sme__swatch" [style.background]="hex(c.color)" [title]="c.label" [attr.aria-label]="c.label" (click)="wrap('[color=' + c.color + ']', '[/color]')"></button>
            }
          </div>
        </div>
      }
      <div class="sme__row">
        <button type="button" class="sme__toggle" [attr.aria-pressed]="open()" [attr.aria-label]="open() ? '收起進階格式' : '進階格式'" [title]="open() ? '收起進階格式' : '進階格式（粗體、連結、劇透…）'" (click)="open.set(!open())">
          <svg lucideTypeOutline aria-hidden="true" focusable="false"></svg>
        </button>
        <textarea #field class="sme__field" [attr.aria-label]="label()" [placeholder]="placeholder()" [rows]="rows()" [value]="value()" (input)="value.set(field.value)" (keydown.control.enter)="submitted.emit()" (keydown.meta.enter)="submitted.emit()"></textarea>
        @if (showSend()) {
          <button type="button" class="sme__send" aria-label="送出" title="送出（Ctrl＋Enter）" [disabled]="!canSend()" (click)="submitted.emit()"><svg lucideSendHorizontal aria-hidden="true" focusable="false"></svg></button>
        }
      </div>
      @if (error()) { <p class="sme__error" role="alert">{{ error() }}</p> }
      @if (open() && value().trim()) {
        <div class="sme__preview"><span class="sme__preview-label">預覽</span><app-social-post-content [content]="value()" /></div>
      }
    </div>
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
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
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

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.uploadMedia(file).subscribe({
      next: (media) => {
        this.uploading.set(false);
        const el = this.field().nativeElement;
        const at = el.selectionEnd ?? el.value.length;
        const head = el.value.slice(0, at);
        const insert = (head.length === 0 || head.endsWith('\n') ? '' : '\n') + '[img=' + media.id + ']\n';
        this.apply(head + insert + el.value.slice(at), at + insert.length, at + insert.length);
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err?.status === 401 ? '上傳圖片失敗：請先登入。' : err?.status === 413 ? '圖片不可超過 8 MB。' : '上傳圖片失敗，請確認格式是 JPEG／PNG／GIF／WebP。');
      },
    });
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
