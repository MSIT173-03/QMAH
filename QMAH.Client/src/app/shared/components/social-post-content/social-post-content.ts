import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { parseSocialMarkup } from '../../social-markup';

/**
 * 貼文內容顯示：把「[b]…[/b]」這類標記解析成節點樹，再以 Angular 範本輸出元素與文字插值。
 * 沒有使用 innerHTML，使用者輸入的 HTML 只會被當成文字，不會有注入問題；標記的白名單見 social-markup.ts。
 */
@Component({
  selector: 'app-social-post-content',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './social-post-content.scss',
  template: `
    <ng-template #tpl let-nodes>
      @for (node of nodes; track $index) {
        @if (node.t === 'text') {
          {{ node.v }}
        } @else {
          @switch (node.n) {
            @case ('b') { <strong><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></strong> }
            @case ('i') { <em><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></em> }
            @case ('u') { <u><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></u> }
            @case ('s') { <s><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></s> }
            @case ('size') { <span [attr.data-size]="node.a"><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></span> }
            @case ('color') { <span [attr.data-color]="node.a"><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></span> }
            @case ('center') { <div class="is-center"><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></div> }
            @case ('spoiler') { <span class="is-spoiler" tabindex="0" role="button" aria-label="劇透內容，點擊顯示" (click)="reveal($event)" (keydown.enter)="reveal($event)"><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></span> }
            @case ('url') { <a [href]="node.a" target="_blank" rel="noopener noreferrer nofollow"><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></a> }
            @case ('hr') { <hr /> }
            @case ('img') { <img class="is-img" [src]="'/api/v1/social/media/' + node.a + '/content'" alt="留言附圖" loading="lazy" /> }
            @case ('h') { <h3><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></h3> }
            @case ('quote') { <blockquote><ng-container *ngTemplateOutlet="tpl; context: { $implicit: node.c }" /></blockquote> }
            @case ('list') {
              <ul class="bullet">
                @for (item of node.items; track $index) {
                  <li><ng-container *ngTemplateOutlet="tpl; context: { $implicit: item }" /></li>
                }
              </ul>
            }
          }
        }
      }
    </ng-template>
    <article class="social-post-content" aria-label="貼文內容">
      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: nodes() }" />
    </article>
  `,
})
export class SocialPostContentComponent {
  // 貼文以純文字儲存（API 契約不變）；格式標記只在顯示時解析。
  content = input.required<string>();

  protected readonly nodes = computed(() => parseSocialMarkup(this.content()));

  /** 劇透內容：點一下才顯示 */
  protected reveal(event: Event): void {
    (event.currentTarget as HTMLElement).classList.add('is-revealed');
  }
}
