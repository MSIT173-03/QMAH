import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type SocialPostBlock =
  | { kind: 'heading' | 'bullet' | 'quote' | 'paragraph' | 'space'; text: string };

@Component({
  selector: 'app-social-post-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="social-post-content" aria-label="貼文內容">
      @for (block of blocks(); track $index) {
        @switch (block.kind) {
          @case ('heading') { <h3>{{ block.text }}</h3> }
          @case ('bullet') { <p class="bullet">{{ block.text }}</p> }
          @case ('quote') { <blockquote>{{ block.text }}</blockquote> }
          @case ('space') { <div class="space" aria-hidden="true"></div> }
          @default { <p>{{ block.text }}</p> }
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .social-post-content { line-height: 1.75; overflow-wrap: anywhere; }
    p { margin: 0 0 .45rem; white-space: pre-wrap; }
    h3 { margin: .7rem 0 .35rem; font-size: 1rem; font-weight: 700; color: oklch(var(--p)); }
    .bullet { padding-left: 1rem; position: relative; }
    .bullet::before { content: '•'; position: absolute; left: 0; font-weight: 700; }
    blockquote { margin: .5rem 0; padding: .35rem .75rem; border-radius: .35rem; background: color-mix(in oklab, currentColor 6%, transparent); color: color-mix(in oklab, currentColor 72%, transparent); }
    .space { height: .35rem; }
  `
})
export class SocialPostContentComponent {
  // 使用純文字標記而非儲存 HTML，保留既有 API 契約，同時讓前台能安全呈現基本層次。
  content = input.required<string>();

  blocks = computed<SocialPostBlock[]>(() =>
    this.content().split('\n').map((line): SocialPostBlock => {
      const text = line.trim();
      if (!text) return { kind: 'space', text: '' };
      if (text.startsWith('【') && text.endsWith('】')) return { kind: 'heading', text };
      if (text.startsWith('• ')) return { kind: 'bullet', text: text.slice(2) };
      if (text.startsWith('> ')) return { kind: 'quote', text: text.slice(2) };
      if (text.startsWith('「') && text.endsWith('」')) return { kind: 'quote', text: text.slice(1, -1) };
      return { kind: 'paragraph', text: line };
    })
  );
}
