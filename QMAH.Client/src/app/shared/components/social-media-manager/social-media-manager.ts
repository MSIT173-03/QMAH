import { ChangeDetectorRef, Component, ViewChild, computed, inject, input, model, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideImagePlus, LucideReplace, LucideTextCursorInput, LucideTrash2 } from '@lucide/angular';

import { SocialApiService, SocialMedia } from '../../../core/services/social-api';
import { ImageCropModalComponent } from '../image-crop-modal/image-crop-modal';

export type SocialMediaLayout = 'PRIMARY' | 'SECONDARY';

const MAX_IMAGES = 8;

/**
 * 發文與編輯貼文共用的圖片管理：新增、抽換、移除、選擇「圖片為主／為輔」，
 * 以及把圖片「插入內文游標處」（[img=識別碼]）或維持單純附圖。
 * 內文是旁邊的 textarea（用 textareaId 指定），插入與抽換時直接改它的值並觸發 input 事件，讓 ngModel 同步。
 */
@Component({
  selector: 'app-social-media-manager',
  imports: [ImageCropModalComponent, LucideImagePlus, LucideReplace, LucideTextCursorInput, LucideTrash2],
  templateUrl: './social-media-manager.html',
  styleUrl: './social-media-manager.scss',
})
export class SocialMediaManagerComponent {
  private readonly socialApi = inject(SocialApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild(ImageCropModalComponent) private cropModal!: ImageCropModalComponent;

  /** 目前這篇貼文的圖片（順序即顯示順序） */
  readonly media = model<SocialMedia[]>([]);
  readonly layout = model<SocialMediaLayout>('SECONDARY');
  /** 貼文內文，用來標示哪些圖片已經插入內文 */
  readonly content = input('');
  /** 內文 textarea 的 id；插入圖片時會改它 */
  readonly textareaId = input.required<string>();

  protected readonly max = MAX_IMAGES;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly inserted = computed(() => {
    const text = this.content().toLowerCase();
    return new Set(this.media().filter((item) => text.includes(`[img=${item.id.toLowerCase()}]`)).map((item) => item.id));
  });

  /** 這次編輯中新上傳的圖片：移除或被抽換時可以直接刪檔；原本就在貼文上的圖片要等「儲存」才由伺服器移除。 */
  private readonly sessionUploads = new Set<string>();
  private queue: { file: File; swapId: string | null }[] = [];
  private current: { swapId: string | null } | null = null;

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const slots = Math.max(0, MAX_IMAGES - this.media().length - this.queue.length);
    this.queue.push(...files.slice(0, slots).map((file) => ({ file, swapId: null })));
    this.next();
  }

  protected onSwapSelected(event: Event, id: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.queue.push({ file, swapId: id });
    this.next();
  }

  private next(): void {
    if (this.current || this.busy()) return;
    const item = this.queue.shift();
    if (!item) return;
    this.current = { swapId: item.swapId };
    this.cropModal.open(item.file);
  }

  protected onCropped(file: File): void {
    const target = this.current;
    this.busy.set(true);
    this.error.set(null);
    this.socialApi.uploadMedia(file).subscribe({
      next: (uploaded) => {
        this.sessionUploads.add(uploaded.id);
        if (target?.swapId) this.applySwap(target.swapId, uploaded);
        else this.media.update((list) => [...list, uploaded]);
        this.finish();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 401
          ? '上傳圖片失敗：請先登入。'
          : err.status === 413
            ? '上傳圖片失敗：單一圖片不可超過 8 MB。'
            : '上傳圖片失敗，請確認檔案格式是否為 JPEG／PNG／GIF／WebP。');
        this.finish();
      },
    });
  }

  protected onCropCancelled(): void {
    this.finish();
  }

  private finish(): void {
    this.current = null;
    this.busy.set(false);
    this.cdr.detectChanges();
    this.next();
  }

  /** 抽換：新圖取代舊圖的位置，內文中的 [img=舊] 一併換成 [img=新]。 */
  private applySwap(oldId: string, fresh: SocialMedia): void {
    this.media.update((list) => list.map((item) => (item.id === oldId ? fresh : item)));
    this.editText((text) => text.split(`[img=${oldId}]`).join(`[img=${fresh.id}]`));
    this.discard(oldId);
  }

  protected remove(item: SocialMedia): void {
    this.media.update((list) => list.filter((entry) => entry.id !== item.id));
    this.editText((text) => text.split(`[img=${item.id}]`).join('').replace(/\n{3,}/g, '\n\n'));
    this.discard(item.id);
  }

  private discard(id: string): void {
    if (!this.sessionUploads.delete(id)) return;
    this.socialApi.deleteMedia(id).subscribe({ error: () => undefined });
  }

  /** 把圖片插到內文游標處（前後各留一個換行，讓圖片獨立成段） */
  protected insert(item: SocialMedia): void {
    const area = this.textarea();
    if (!area) return;
    const tag = `[img=${item.id}]`;
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? start;
    const before = area.value.slice(0, start);
    const after = area.value.slice(end);
    const lead = before && !before.endsWith('\n') ? '\n' : '';
    const tail = after && !after.startsWith('\n') ? '\n' : '';
    area.value = `${before}${lead}${tag}${tail}${after}`;
    const caret = (before + lead + tag + tail).length;
    area.setSelectionRange(caret, caret);
    this.notify(area);
    area.focus();
  }

  /** 取消插入：圖片回到單純附圖 */
  protected uninsert(item: SocialMedia): void {
    this.editText((text) => text.split(`[img=${item.id}]`).join('').replace(/\n{3,}/g, '\n\n'));
  }

  private textarea(): HTMLTextAreaElement | null {
    return document.getElementById(this.textareaId()) as HTMLTextAreaElement | null;
  }

  private editText(change: (text: string) => string): void {
    const area = this.textarea();
    if (!area) return;
    const next = change(area.value);
    if (next === area.value) return;
    area.value = next;
    this.notify(area);
  }

  private notify(area: HTMLTextAreaElement): void {
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
