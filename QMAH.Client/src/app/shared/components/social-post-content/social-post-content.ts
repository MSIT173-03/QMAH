import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type SocialPostBlock =
  | { kind: 'heading' | 'quote' | 'paragraph' | 'space'; text: string }
  | { kind: 'list'; items: string[] };

@Component({
  selector: 'app-social-post-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-post-content.scss',
  template: `
    <article class="social-post-content" aria-label="貼文內容">
      @for (block of blocks(); track $index) {
        @switch (block.kind) {
          @case ('heading') { <h3>{{ block.text }}</h3> }
          @case ('list') {
            <ul class="bullet">
              @for (item of block.items; track $index) {
                <li>{{ item }}</li>
              }
            </ul>
          }
          @case ('quote') { <blockquote>{{ block.text }}</blockquote> }
          @case ('space') { <div class="space" aria-hidden="true"></div> }
          @case ('paragraph') { <p>{{ block.text }}</p> }
        }
      }
    </article>
  `
})
export class SocialPostContentComponent {
  // 使用純文字標記而非儲存 HTML，保留既有 API 契約，同時讓前台能安全呈現基本層次。
  content = input.required<string>();

  blocks = computed<SocialPostBlock[]>(() => {
    const blocks: SocialPostBlock[] = [];

    for (const line of this.content().split('\n')) {
      const text = line.trim();
      if (!text) {
        blocks.push({ kind: 'space', text: '' });
        continue;
      }

      if (text.startsWith('【') && text.endsWith('】')) {
        blocks.push({ kind: 'heading', text });
        continue;
      }

      if (text.startsWith('• ')) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock?.kind === 'list') {
          lastBlock.items.push(text.slice(2));
        } else {
          blocks.push({ kind: 'list', items: [text.slice(2)] });
        }
        continue;
      }

      if (text.startsWith('> ')) {
        blocks.push({ kind: 'quote', text: text.slice(2) });
        continue;
      }

      if (text.startsWith('「') && text.endsWith('」')) {
        blocks.push({ kind: 'quote', text: text.slice(1, -1) });
        continue;
      }

      blocks.push({ kind: 'paragraph', text: line });
    }

    return blocks;
  });
}
