import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideCalendarDays, LucideMapPin, LucideUsers, LucideArrowUpRight } from '@lucide/angular';
import { parseSocialEventSummary } from '../../social-event-summary';
import { stripSocialMarkup } from '../../social-markup';
import { SocialPostContentComponent } from '../social-post-content/social-post-content';
import { SocialPostListItem } from '../../../core/services/social-api';

@Component({
  selector: 'app-social-event-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SocialPostContentComponent, LucideCalendarDays, LucideMapPin, LucideUsers, LucideArrowUpRight],
  styleUrl: './social-event-content.scss',
  template: `
    @if (summary(); as event) {
      @if (event.description) {
        @if (preview()) { <p class="excerpt">{{ plainDescription() }}</p> }
        @else { <app-social-post-content [content]="event.description" /> }
      }
      <section class="event-info" aria-label="活動資訊">
        <header><span>活動資訊</span>
          @if (eventId()) { <a [routerLink]="['/social/events', eventId()]">查看活動<svg lucideArrowUpRight aria-hidden="true"></svg></a> }
        </header>
        <dl>
          <div><dt><svg lucideCalendarDays aria-hidden="true"></svg>時間</dt><dd><span>{{ event.start }}</span><span class="end">至 {{ event.end }}</span></dd></div>
          <div><dt><svg lucideMapPin aria-hidden="true"></svg>地點</dt><dd>{{ event.location }}</dd></div>
          <div><dt><svg lucideUsers aria-hidden="true"></svg>名額</dt><dd>{{ event.capacity }}</dd></div>
        </dl>
      </section>
    } @else {
      @if (preview()) { <p class="excerpt">{{ plainContent() }}</p> }
      @else { <app-social-post-content [content]="content()" /> }
    }
  `,
})
export class SocialEventContentComponent {
  readonly content = input.required<string>();
  readonly preview = input(false);
  readonly eventId = input<string | null>(null);
  readonly eventSummary = input<SocialPostListItem['eventSummary']>(null);
  protected readonly summary = computed(() => {
    const parsed = parseSocialEventSummary(this.content());
    const event = this.eventSummary();
    if (!event) return parsed;
    return {
      description: parsed?.description ?? this.content().replace(/\s+活動資訊\s+時間[：:][\s\S]*$/, '').trimEnd(),
      start: formatDate(event.startAt, 'yyyy/MM/dd HH:mm', 'en-US'),
      end: formatDate(event.endAt, 'yyyy/MM/dd HH:mm', 'en-US'),
      location: event.location || '地點待補充',
      capacity: event.capacity === null ? '不限人數' : `${event.capacity} 人`,
    };
  });
  protected readonly plainDescription = computed(() => stripSocialMarkup(this.summary()?.description ?? ''));
  protected readonly plainContent = computed(() => stripSocialMarkup(this.content()));
}
