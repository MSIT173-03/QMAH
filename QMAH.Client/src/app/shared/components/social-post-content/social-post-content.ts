import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SocialSegment, parseSocialInline } from '../../social-markup';

type SocialPostBlock =
  | { kind: 'heading' | 'quote' | 'paragraph'; segments: SocialSegment[] }
  | { kind: 'space' }
  | { kind: 'list'; items: SocialSegment[][] };

@Component({
  selector: 'app-social-post-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-post-content.scss',
  template: `
    <article class="social-post-content" aria-label="貼文內容">
      @for (block of blocks(); track $index) {
        @switch (block.kind) {
          @case ('heading') { <h3>@for (part of block.segments; track $index) { <span [class.b]="part.bold" [class.i]="part.italic" [attr.data-size]="part.size ?? null" [attr.data-color]="part.color ?? null">{{ part.text }}</span> }</h3> }
          @case ('list') {
            <ul class="bullet">
              @for (item of block.items; track $index) {
                <li>@for (part of item; track $index) { <span [class.b]="part.bold" [class.i]="part.italic" [attr.data-size]="part.size ?? null" [attr.data-color]="part.color ?? null">{{ part.text }}</span> }</li>
              }
            </ul>
          }
          @case ('quote') { <blockquote>@for (part of block.segments; track $index) { <span [class.b]="part.bold" [class.i]="part.italic" [attr.data-size]="part.size ?? null" [attr.data-color]="part.color ?? null">{{ part.text }}</span> }</blockquote> }
          @case ('space') { <div class="space" aria-hidden="true"></div> }
          @case ('paragraph') { <p>@for (part of block.segments; track $index) { <span [class.b]="part.bold" [class.i]="part.italic" [attr.data-size]="part.size ?? null" [attr.data-color]="part.color ?? null">{{ part.text }}</span> }</p> }
        }
      }
    </article>
  `
})
export class SocialPostContentComponent {
  // 使用純文字標記而非儲存 HTML，保留既有 API 契約；行內格式由 parseSocialInline 轉成片段並以文字插值輸出（不用 innerHTML），所以不會有 HTML 注入。
  content = input.required<string>();

  blocks = computed<SocialPostBlock[]>(() => {
    const blocks: SocialPostBlock[] = [];

    for (const line of this.content().split('\n')) {
      const text = line.trim();
      if (!text) {
        blocks.push({ kind: 'space' });
        continue;
      }

      if (text.startsWith('【') && text.endsWith('】')) {
        blocks.push({ kind: 'heading', segments: parseSocialInline(text) });
        continue;
      }

      if (text.startsWith('• ')) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock?.kind === 'list') {
          lastBlock.items.push(parseSocialInline(text.slice(2)));
        } else {
          blocks.push({ kind: 'list', items: [parseSocialInline(text.slice(2))] });
        }
        continue;
      }

      if (text.startsWith('> ')) {
        blocks.push({ kind: 'quote', segments: parseSocialInline(text.slice(2)) });
        continue;
      }

      if (text.startsWith('「') && text.endsWith('」')) {
        blocks.push({ kind: 'quote', segments: parseSocialInline(text.slice(1, -1)) });
        continue;
      }

      blocks.push({ kind: 'paragraph', segments: parseSocialInline(line) });
    }

    return blocks;
  });
}
