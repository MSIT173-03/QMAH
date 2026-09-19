import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type SocialPostBlock =
  | { kind: 'heading' | 'bullet' | 'quote' | 'paragraph' | 'space'; text: string };

@Component({
  selector: 'app-social-post-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-post-content.scss',
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
